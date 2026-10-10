import { Inject, Injectable } from "@nestjs/common";
import { type Database, sql } from "@sentinel/db";
import type { QuotaKind } from "@sentinel/shared";
import { DB } from "../database/database.module.js";

export interface Limits {
	events: number | null;
	transactions: number | null;
}

type Row = Record<string, unknown>;

@Injectable()
export class QuotaRepository {
	constructor(@Inject(DB) private readonly db: Database) {}

	async limits(projectId: string): Promise<Limits | undefined> {
		const result = await this.db.execute(sql`
			select monthly_event_quota, monthly_transaction_quota from project where id = ${projectId}::uuid`);
		const row = (result.rows as Row[])[0];
		if (!row) return undefined;
		return {
			events: (row.monthly_event_quota as number | null) ?? null,
			transactions: (row.monthly_transaction_quota as number | null) ?? null,
		};
	}

	/** ¿El proyecto existe y es de esa organización? */
	async projectInOrg(orgId: string, projectId: string): Promise<boolean> {
		const result = await this.db.execute(sql`
			select 1 from project where id = ${projectId}::uuid and organization_id = ${orgId}`);
		return result.rows.length > 0;
	}

	/** Lo ya guardado desde `from`: con esto se reconstruye un contador de Redis que se perdió. */
	async countSince(
		projectId: string,
		kind: QuotaKind,
		from: Date,
	): Promise<number> {
		const table = kind === "events" ? sql`event` : sql`perf_transaction`;
		const result = await this.db.execute(sql`
			select count(*)::int as n from ${table}
			where project_id = ${projectId}::uuid and received_at >= ${from.toISOString()}::timestamptz`);
		return Number((result.rows as Row[])[0]?.n ?? 0);
	}
}
