import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { QuotaKind, UsageDto } from "@sentinel/shared";
import type { Redis } from "ioredis";
import { REDIS } from "../redis/redis.module.js";
import {
	isOverQuota,
	monthKey,
	monthStart,
	nextMonthStart,
	retryAfterSeconds,
} from "./quota.domain.js";
import { type Limits, QuotaRepository } from "./quota.repository.js";

/** Los límites se leen de la base de datos como mucho cada 30 s (se miran en cada petición de ingesta). */
const LIMITS_TTL_MS = 30_000;
/** Un contador sobrevive al mes (por si hay un desfase de reloj) y luego se limpia solo. */
const COUNTER_TTL_SECONDS = 40 * 86_400;

export interface QuotaDecision {
	allowed: boolean;
	retryAfterSeconds: number;
}

@Injectable()
export class QuotaService {
	private readonly limitsCache = new Map<
		string,
		{ at: number; value: Limits | undefined }
	>();

	constructor(
		private readonly repository: QuotaRepository,
		@Inject(REDIS) private readonly redis: Redis,
	) {}

	/** Lanza 404 si el proyecto no existe en la organización. */
	async requireProject(orgId: string, projectId: string): Promise<void> {
		if (!(await this.repository.projectInOrg(orgId, projectId)))
			throw new NotFoundException({ reason: "PROJECT_NOT_FOUND" });
	}

	/** Para cuando se cambian los límites de un proyecto: que surtan efecto ya. */
	invalidate(projectId: string): void {
		this.limitsCache.delete(projectId);
	}

	async limits(
		projectId: string,
		now = Date.now(),
	): Promise<Limits | undefined> {
		const cached = this.limitsCache.get(projectId);
		if (cached && now - cached.at < LIMITS_TTL_MS) return cached.value;
		const value = await this.repository.limits(projectId);
		this.limitsCache.set(projectId, { at: now, value });
		return value;
	}

	/** ¿Puede el proyecto seguir enviando este tipo de datos este mes? */
	async check(
		projectId: string,
		kind: QuotaKind,
		now = new Date(),
	): Promise<QuotaDecision> {
		const limit = (await this.limits(projectId, now.getTime()))?.[kind] ?? null;
		if (limit === null) return { allowed: true, retryAfterSeconds: 0 };
		const used = await this.used(projectId, kind, now);
		return {
			allowed: !isOverQuota(used, limit),
			retryAfterSeconds: retryAfterSeconds(now),
		};
	}

	/** Cuenta un evento o una transacción aceptados. */
	async record(
		projectId: string,
		kind: QuotaKind,
		now = new Date(),
	): Promise<void> {
		const key = this.key(projectId, kind, now);
		// Si el contador no existía (primer envío del mes o Redis vacío), se parte de lo ya guardado.
		if ((await this.redis.exists(key)) === 0)
			await this.seed(projectId, kind, now);
		await this.redis.incr(key);
	}

	async used(
		projectId: string,
		kind: QuotaKind,
		now = new Date(),
	): Promise<number> {
		const key = this.key(projectId, kind, now);
		const value = await this.redis.get(key);
		if (value !== null) return Number(value);
		return this.seed(projectId, kind, now);
	}

	async usage(projectId: string, now = new Date()): Promise<UsageDto> {
		const limits = (await this.limits(projectId, now.getTime())) ?? {
			events: null,
			transactions: null,
		};
		const [events, transactions] = await Promise.all([
			this.used(projectId, "events", now),
			this.used(projectId, "transactions", now),
		]);
		return {
			month: monthKey(now),
			resetsAt: nextMonthStart(now).toISOString(),
			events: { used: events, quota: limits.events },
			transactions: { used: transactions, quota: limits.transactions },
		};
	}

	private key(projectId: string, kind: QuotaKind, now: Date): string {
		return `quota:${projectId}:${monthKey(now)}:${kind}`;
	}

	/** Reconstruye el contador desde la base de datos (`SET NX`: si otro ya lo creó, gana el suyo). */
	private async seed(
		projectId: string,
		kind: QuotaKind,
		now: Date,
	): Promise<number> {
		const base = await this.repository.countSince(
			projectId,
			kind,
			monthStart(now),
		);
		const key = this.key(projectId, kind, now);
		await this.redis.set(key, base, "EX", COUNTER_TTL_SECONDS, "NX");
		return Number((await this.redis.get(key)) ?? base);
	}
}
