import { Inject, Injectable } from "@nestjs/common";
import { type Database, sql } from "@sentinel/db";
import { DB } from "../database/database.module.js";
import {
	type RetentionProject,
	RetentionRepository,
} from "./retention.repository.js";

type Row = Record<string, unknown>;

@Injectable()
export class DrizzleRetentionRepository extends RetentionRepository {
	constructor(@Inject(DB) private readonly db: Database) {
		super();
	}

	async projects(): Promise<RetentionProject[]> {
		const result = await this.db.execute(
			sql`select id::text, retention_days from project`,
		);
		return (result.rows as Row[]).map((r) => ({
			id: r.id as string,
			retentionDays: Number(r.retention_days),
		}));
	}

	// Se borra por lotes con una subconsulta `limit`: una sola sentencia con millones de filas bloquearía
	// la tabla y llenaría el WAL de golpe.
	async deleteStaleIssues(projectId: string, cutoff: Date, limit: number) {
		return this.count(sql`
			delete from issue where id in (
				select id from issue
				where project_id = ${projectId} and last_seen < ${cutoff.toISOString()}::timestamptz
				limit ${limit})`);
	}

	async deleteOldEvents(projectId: string, cutoff: Date, limit: number) {
		return this.count(sql`
			delete from event where id in (
				select id from event
				where project_id = ${projectId} and "timestamp" < ${cutoff.toISOString()}::timestamptz
				limit ${limit})`);
	}

	async deleteOldTransactions(projectId: string, cutoff: Date, limit: number) {
		return this.count(sql`
			delete from perf_transaction where id in (
				select id from perf_transaction
				where project_id = ${projectId} and "timestamp" < ${cutoff.toISOString()}::timestamptz
				limit ${limit})`);
	}

	private async count(statement: ReturnType<typeof sql>): Promise<number> {
		const result = await this.db.execute(statement);
		return result.rowCount ?? 0;
	}
}
