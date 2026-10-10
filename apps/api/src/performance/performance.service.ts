import { Injectable, NotFoundException } from "@nestjs/common";
import {
	type ListSamplesQuery,
	type ListTransactionsQuery,
	type OverviewQuery,
	PERIOD_CONFIG,
	type PerformanceOverviewDto,
	type SampleDetailDto,
	type SampleListDto,
	type StatsPeriod,
	type TransactionListDto,
} from "@sentinel/shared";
import { bucketRange } from "../issues/stats/stats.domain.js";
import { OrgAccessService } from "../organizations/org-access.service.js";
import { ProjectsService } from "../projects/projects.service.js";
import {
	buildWaterfall,
	errorRate,
	fillSeries,
	summarizeVitals,
	throughputPerMinute,
} from "./performance.domain.js";
import {
	type Filters,
	PerformanceRepository,
} from "./performance.repository.js";

@Injectable()
export class PerformanceService {
	constructor(
		private readonly repo: PerformanceRepository,
		private readonly access: OrgAccessService,
		private readonly projects: ProjectsService,
	) {}

	async transactions(
		userId: string,
		orgId: string,
		projectId: string,
		query: ListTransactionsQuery,
		now = new Date(),
	): Promise<TransactionListDto> {
		await this.authorize(userId, orgId, projectId);
		const filters = this.filters(projectId, query, now);
		const { items, total } = await this.repo.groups(filters, query);
		return {
			items: items.map((g) => ({
				name: g.name,
				op: g.op,
				count: g.count,
				p50: g.p50,
				p95: g.p95,
				p99: g.p99,
				errorRate: errorRate(g.errors, g.count),
				tpm: throughputPerMinute(g.count, query.period),
				lastSeen: g.lastSeen.toISOString(),
			})),
			total,
			limit: query.limit,
			offset: query.offset,
		};
	}

	async overview(
		userId: string,
		orgId: string,
		projectId: string,
		query: OverviewQuery,
		now = new Date(),
	): Promise<PerformanceOverviewDto> {
		await this.authorize(userId, orgId, projectId);
		const range = bucketRange(now, query.period);
		const filters = {
			...this.filters(projectId, query, now),
			name: query.name,
		};
		// La serie arranca en el primer intervalo completo; el resumen usa la misma ventana.
		filters.from = range.from;
		const [summary, series, vitals] = await Promise.all([
			this.repo.summary(filters),
			this.repo.series(filters, PERIOD_CONFIG[query.period].bucketHours),
			// Los Web Vitals son de la carga de página: no tienen sentido para una transacción concreta de otro tipo.
			this.repo.vitals(filters),
		]);
		return {
			period: query.period,
			bucketMinutes: range.bucketMs / 60_000,
			from: range.from.toISOString(),
			to: range.to.toISOString(),
			summary: {
				count: summary.count,
				p50: summary.p50,
				p95: summary.p95,
				p99: summary.p99,
				errorRate: errorRate(summary.errors, summary.count),
				tpm: throughputPerMinute(summary.count, query.period),
			},
			vitals: summarizeVitals(vitals),
			points: fillSeries(series, range),
		};
	}

	async samples(
		userId: string,
		orgId: string,
		projectId: string,
		query: ListSamplesQuery,
		now = new Date(),
	): Promise<SampleListDto> {
		await this.authorize(userId, orgId, projectId);
		const rows = await this.repo.samples(
			{ ...this.filters(projectId, query, now), name: query.name },
			query.sort,
			query.limit,
		);
		return {
			items: rows.map((r) => ({
				...r,
				timestamp: r.timestamp.toISOString(),
			})),
		};
	}

	async sample(
		userId: string,
		orgId: string,
		projectId: string,
		transactionId: string,
	): Promise<SampleDetailDto> {
		await this.authorize(userId, orgId, projectId);
		const row = await this.repo.sample(projectId, transactionId);
		if (!row) throw new NotFoundException({ reason: "TRANSACTION_NOT_FOUND" });
		const spans = await this.repo.spans(row.id);
		return {
			id: row.id,
			traceId: row.traceId,
			timestamp: row.timestamp.toISOString(),
			durationMs: row.durationMs,
			status: row.status,
			release: row.release,
			environment: row.environment,
			user: row.user,
			name: row.name,
			op: row.op,
			spanId: row.spanId,
			platform: row.platform,
			measurements: row.measurements,
			tags: row.tags,
			spans: buildWaterfall(row.timestamp.getTime(), spans),
		};
	}

	private async authorize(userId: string, orgId: string, projectId: string) {
		await this.access.assert(userId, orgId, "member");
		await this.projects.ensureExists(orgId, projectId);
	}

	private filters(
		projectId: string,
		query: { period: StatsPeriod; environment?: string; release?: string },
		now: Date,
	): Filters {
		return {
			projectId,
			from: new Date(
				now.getTime() - PERIOD_CONFIG[query.period].hours * 3_600_000,
			),
			environment: query.environment,
			release: query.release,
		};
	}
}
