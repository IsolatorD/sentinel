import { Inject, Injectable } from "@nestjs/common";
import { type Database, sql } from "@sentinel/db";
import {
	AlertsRepository,
	type RuleRecord,
} from "../alerts/alerts.repository.js";
import { DB } from "../database/database.module.js";
import type { Measurement } from "./performance-alerts.domain.js";
import {
	type MeasureQuery,
	PerformanceAlertsRepository,
} from "./performance-alerts.repository.js";

type Row = Record<string, unknown>;

@Injectable()
export class DrizzlePerformanceAlertsRepository extends PerformanceAlertsRepository {
	constructor(
		@Inject(DB) private readonly db: Database,
		private readonly alerts: AlertsRepository,
	) {
		super();
	}

	rules(): Promise<RuleRecord[]> {
		return this.alerts.activePerformanceRules();
	}

	/** Se mide por cuándo llegaron las transacciones, no por cuándo empezaron: un SDK que reenvía un buffer viejo no falsea la ventana. */
	async measure(q: MeasureQuery): Promise<Measurement> {
		const environment = q.environment
			? sql` and environment = ${q.environment}`
			: sql``;
		const name = q.transactionName
			? sql` and name = ${q.transactionName}`
			: sql``;
		const result = await this.db.execute(sql`
			select count(*)::int as samples,
			       percentile_cont(0.95) within group (order by duration_ms) as p95,
			       (count(*) filter (where status <> 'ok'))::int as errors
			from perf_transaction
			where project_id = ${q.projectId}
			  and received_at >= ${q.since.toISOString()}::timestamptz${environment}${name}`);
		const row = (result.rows as Row[])[0] ?? {};
		return {
			sampleCount: Number(row.samples ?? 0),
			p95: row.p95 === null || row.p95 === undefined ? null : Number(row.p95),
			errors: Number(row.errors ?? 0),
		};
	}
}
