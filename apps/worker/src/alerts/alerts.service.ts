import { InjectQueue } from "@nestjs/bullmq";
import {
	Inject,
	Injectable,
	Logger,
	type OnModuleDestroy,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
	type IssueAlertPayload,
	type IssueTrigger,
	isPerformanceTrigger,
	NOTIFICATIONS_QUEUE,
	type NotificationJobData,
	type PerformanceAlertPayload,
	type PerformanceTrigger,
} from "@sentinel/shared";
import type { Queue } from "bullmq";
import type { Redis } from "ioredis";
import type { WorkerEnv } from "../config/env.js";
import { TtlCache } from "../events/domain/ttl-cache.js";
import type { SaveResult } from "../events/event.repository.js";
import {
	AlertsRepository,
	type ChannelRecord,
	type IssueContext,
	type RuleRecord,
} from "./alerts.repository.js";
import { performanceSummary } from "./domain/messages.js";
import {
	firesOnEvent,
	frequencyReached,
	passesFilters,
	type StoredEvent,
} from "./domain/rule-matching.js";
import { ALERTS_REDIS } from "./redis.provider.js";

/** Las reglas cambian poco y se leen en cada evento: una caché corta evita una consulta por evento. */
const RULES_TTL_MS = 5_000;

/** Regla de issues: sus tipos se disparan por lo que le pasa a un issue. */
type IssueRule = RuleRecord & { trigger: IssueTrigger };

/** Una medida de rendimiento que cruzó el umbral de una regla. */
export interface PerformanceBreach {
	rule: RuleRecord & { trigger: PerformanceTrigger };
	/** p95 en ms, o tasa de errores en porcentaje. */
	value: number;
	sampleCount: number;
}

export interface StoredEventInfo extends StoredEvent {
	projectId: string;
	release?: string;
}

@Injectable()
export class AlertsService implements OnModuleDestroy {
	private readonly logger = new Logger(AlertsService.name);
	private readonly rulesCache = new TtlCache<IssueRule[]>(500);
	private readonly webOrigin: string;
	private readonly retryDelayMs: number;

	constructor(
		private readonly repository: AlertsRepository,
		@InjectQueue(NOTIFICATIONS_QUEUE)
		private readonly queue: Queue<NotificationJobData>,
		@Inject(ALERTS_REDIS) private readonly redis: Redis,
		config: ConfigService<WorkerEnv, true>,
	) {
		this.webOrigin = config
			.get("WEB_ORIGIN", { infer: true })
			.replace(/\/$/, "");
		this.retryDelayMs = config.get("NOTIFICATION_RETRY_DELAY_MS", {
			infer: true,
		});
	}

	/**
	 * Evalúa las reglas del proyecto con el evento recién guardado y encola un aviso por cada canal.
	 * Nunca lanza: un fallo en las alertas no debe hacer perder ni reintentar el evento.
	 */
	async onEventStored(
		result: SaveResult,
		info: StoredEventInfo,
	): Promise<void> {
		if (result.duplicate || !result.issueId) return;
		try {
			await this.evaluate(result.issueId, info);
		} catch (error) {
			this.logger.error(
				`no se pudieron evaluar las alertas: ${(error as Error).message}`,
			);
		}
	}

	private async evaluate(
		issueId: string,
		info: StoredEventInfo,
	): Promise<void> {
		const rules = await this.rulesFor(info.projectId);
		const candidates = rules.filter((r) => passesFilters(r, info));
		if (candidates.length === 0) return;

		const counts = new Map<number, number>(); // ventana -> eventos (varias reglas comparten consulta)
		const due: Array<{ rule: IssueRule; count?: number }> = [];
		for (const rule of candidates) {
			if (rule.trigger === "frequency") {
				const window = rule.windowMinutes ?? 0;
				if (!counts.has(window)) {
					const since = new Date(Date.now() - window * 60_000);
					counts.set(
						window,
						await this.repository.countRecentEvents(issueId, since),
					);
				}
				const count = counts.get(window) ?? 0;
				if (frequencyReached(rule, count)) due.push({ rule, count });
			} else if (firesOnEvent(rule, info)) {
				due.push({ rule });
			}
		}

		const toSend: typeof due = [];
		for (const item of due) {
			if (await this.acquireCooldown(item.rule, issueId)) toSend.push(item);
		}
		if (toSend.length === 0) return;

		const context = await this.repository.issueContext(issueId);
		if (!context) return;
		const channels = new Map<string, ChannelRecord>(
			(
				await this.repository.channelsByIds([
					...new Set(toSend.flatMap((d) => d.rule.channelIds)),
				])
			).map((c) => [c.id, c]),
		);

		for (const { rule, count } of toSend) {
			const payload = this.payload(context, rule, info, count);
			const targets = rule.channelIds.flatMap((id) => channels.get(id) ?? []);
			await this.dispatch(
				targets.map((channel) => ({
					projectId: info.projectId,
					kind: "alert" as const,
					ruleId: rule.id,
					ruleName: rule.name,
					channelId: channel.id,
					channelName: channel.name,
					channelType: channel.type,
					issueId,
					issueTitle: context.issue.title,
					payload,
				})),
			);
		}
	}

	async onModuleDestroy(): Promise<void> {
		await this.redis.quit();
	}

	private async rulesFor(projectId: string): Promise<IssueRule[]> {
		const cached = this.rulesCache.get(projectId);
		if (cached) return cached.value;
		const rules = (await this.repository.activeRules(projectId)).filter(
			(r): r is IssueRule => !isPerformanceTrigger(r.trigger),
		);
		this.rulesCache.set(projectId, rules, RULES_TTL_MS);
		return rules;
	}

	/**
	 * Un solo aviso por regla y "sujeto" (el issue, o `perf` en las reglas de rendimiento) dentro del
	 * período de espera (atómico: `SET NX EX`).
	 */
	private async acquireCooldown(
		rule: RuleRecord,
		subject: string,
	): Promise<boolean> {
		if (rule.cooldownMinutes <= 0) return true;
		const ok = await this.redis.set(
			`alert:cooldown:${rule.id}:${subject}`,
			"1",
			"EX",
			rule.cooldownMinutes * 60,
			"NX",
		);
		return ok === "OK";
	}

	/**
	 * Aviso de una regla de rendimiento. Respeta la espera de la regla: mientras el problema siga
	 * ahí se repite cada `cooldownMinutes`, no en cada evaluación. Nunca lanza.
	 */
	async onPerformanceBreach(breach: PerformanceBreach): Promise<boolean> {
		const { rule } = breach;
		try {
			if (!(await this.acquireCooldown(rule, "perf"))) return false;
			const context = await this.repository.projectContext(rule.projectId);
			if (!context) return false;
			const channels = await this.repository.channelsByIds(rule.channelIds);
			if (channels.length === 0) return false;
			const payload = this.performancePayload(context, breach);
			await this.dispatch(
				channels.map((channel) => ({
					projectId: rule.projectId,
					kind: "alert" as const,
					ruleId: rule.id,
					ruleName: rule.name,
					channelId: channel.id,
					channelName: channel.name,
					channelType: channel.type,
					issueId: null,
					issueTitle: performanceSummary(payload),
					payload,
				})),
			);
			return true;
		} catch (error) {
			this.logger.error(
				`no se pudo avisar de la regla de rendimiento ${rule.id}: ${(error as Error).message}`,
			);
			return false;
		}
	}

	private performancePayload(
		context: Pick<IssueContext, "project" | "organization">,
		{ rule, value, sampleCount }: PerformanceBreach,
	): PerformanceAlertPayload {
		const base = `${this.webOrigin}/${context.organization.slug}/projects/${context.project.slug}/performance`;
		return {
			kind: "performance",
			trigger: rule.trigger,
			ruleName: rule.name,
			organization: context.organization,
			project: context.project,
			performance: {
				transaction: rule.transactionName,
				environment: rule.environment,
				value,
				threshold: rule.threshold ?? 0,
				windowMinutes: rule.windowMinutes ?? 0,
				sampleCount,
			},
			url: rule.transactionName
				? `${base}/transaction?name=${encodeURIComponent(rule.transactionName)}`
				: base,
		};
	}

	private payload(
		context: IssueContext,
		rule: IssueRule,
		info: StoredEventInfo,
		count?: number,
	): IssueAlertPayload {
		const { issue } = context;
		return {
			kind: "alert",
			trigger: rule.trigger,
			ruleName: rule.name,
			organization: context.organization,
			project: context.project,
			issue: {
				id: issue.id,
				title: issue.title,
				culprit: issue.culprit,
				type: issue.type,
				level: issue.level,
				eventCount: issue.eventCount,
				firstSeen: issue.firstSeen.toISOString(),
				lastSeen: issue.lastSeen.toISOString(),
				environment: info.environment ?? null,
				release: info.release ?? issue.lastRelease,
				regressedInRelease: issue.regressedInRelease,
			},
			...(count !== undefined &&
				rule.windowMinutes && {
					frequency: { count, windowMinutes: rule.windowMinutes },
				}),
			url: `${this.webOrigin}/${context.organization.slug}/projects/${context.project.slug}/issues/${issue.id}`,
		};
	}

	/** Guarda cada aviso y lo encola; si falla el encolado el aviso queda registrado como fallido. */
	async dispatch(
		rows: Parameters<AlertsRepository["createDeliveries"]>[0],
	): Promise<void> {
		const ids = await this.repository.createDeliveries(rows);
		await this.queue.addBulk(
			ids.map((id) => ({
				name: "notify",
				data: { deliveryId: id },
				opts: {
					jobId: id,
					attempts: 5,
					backoff: { type: "exponential", delay: this.retryDelayMs },
					removeOnComplete: { age: 3_600 },
					removeOnFail: { age: 7 * 24 * 3_600 },
				},
			})),
		);
	}
}
