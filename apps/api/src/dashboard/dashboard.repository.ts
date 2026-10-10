import { Inject, Injectable } from "@nestjs/common";
import { type Database, sql } from "@sentinel/db";
import type { IssueStatus } from "@sentinel/shared";
import { DB } from "../database/database.module.js";
import type { Counts } from "./dashboard.domain.js";

type Row = Record<string, unknown>;

export interface Window {
	projectId: string;
	from: Date;
	to: Date;
	environment?: string;
}

const iso = (d: Date) => d.toISOString();
const ORIGIN = sql`timestamptz '2000-01-01 00:00:00+00'`;
const toInt = (v: unknown) => Number(v ?? 0);

// Única capa que conoce el SQL del panel de estadísticas.
@Injectable()
export class DashboardRepository {
	constructor(@Inject(DB) private readonly db: Database) {}

	private eventWhere(w: Window) {
		const parts = [
			sql`e.project_id = ${w.projectId}::uuid`,
			sql`e."timestamp" >= ${iso(w.from)}::timestamptz`,
			sql`e."timestamp" < ${iso(w.to)}::timestamptz`,
		];
		if (w.environment) parts.push(sql`e.environment = ${w.environment}`);
		return sql.join(parts, sql` and `);
	}

	private txWhere(w: Window) {
		const parts = [
			sql`x.project_id = ${w.projectId}::uuid`,
			sql`x."timestamp" >= ${iso(w.from)}::timestamptz`,
			sql`x."timestamp" < ${iso(w.to)}::timestamptz`,
		];
		if (w.environment) parts.push(sql`x.environment = ${w.environment}`);
		return sql.join(parts, sql` and `);
	}

	async eventTotals(w: Window): Promise<{ events: number; users: number }> {
		const r = (
			await this.db.execute(sql`
			select count(*)::int as events, count(distinct e.user_identifier)::int as users
			from event e where ${this.eventWhere(w)}`)
		).rows as Row[];
		return { events: toInt(r[0]?.events), users: toInt(r[0]?.users) };
	}

	async newIssues(w: Window): Promise<number> {
		const r = (
			await this.db.execute(sql`
			select count(*)::int as n from issue
			where project_id = ${w.projectId}::uuid and first_seen >= ${iso(w.from)}::timestamptz and first_seen < ${iso(w.to)}::timestamptz`)
		).rows as Row[];
		return toInt(r[0]?.n);
	}

	async resolvedIssues(w: Window): Promise<number> {
		const r = (
			await this.db.execute(sql`
			select count(*)::int as n from issue_activity a join issue i on i.id = a.issue_id
			where i.project_id = ${w.projectId}::uuid and a.type = 'status' and a.data->>'to' = 'resolved'
			  and a.created_at >= ${iso(w.from)}::timestamptz and a.created_at < ${iso(w.to)}::timestamptz`)
		).rows as Row[];
		return toInt(r[0]?.n);
	}

	async transactionTotals(
		w: Window,
	): Promise<{ count: number; errors: number; p95: number | null }> {
		const r = (
			await this.db.execute(sql`
			select count(*)::int as n, (count(*) filter (where x.status <> 'ok'))::int as errors,
			       percentile_cont(0.95) within group (order by x.duration_ms) as p95
			from perf_transaction x where ${this.txWhere(w)}`)
		).rows as Row[];
		const p95 = r[0]?.p95;
		return {
			count: toInt(r[0]?.n),
			errors: toInt(r[0]?.errors),
			p95:
				p95 === null || p95 === undefined
					? null
					: Math.round(Number(p95) * 100) / 100,
		};
	}

	/** Eventos, issues nuevos y transacciones por intervalo (tres consultas, unidas después). */
	async series(w: Window, bucketHours: number): Promise<Counts[]> {
		const bucket = (col: string) =>
			sql`date_bin(${`${bucketHours} hours`}::interval, ${sql.raw(col)}, ${ORIGIN})`;
		const [events, issues, txs] = await Promise.all([
			this.db.execute(
				sql`select ${bucket('e."timestamp"')} as bucket, count(*)::int as n from event e where ${this.eventWhere(w)} group by 1`,
			),
			this.db.execute(sql`select ${bucket("first_seen")} as bucket, count(*)::int as n from issue
				where project_id = ${w.projectId}::uuid and first_seen >= ${iso(w.from)}::timestamptz and first_seen < ${iso(w.to)}::timestamptz group by 1`),
			this.db.execute(
				sql`select ${bucket('x."timestamp"')} as bucket, count(*)::int as n from perf_transaction x where ${this.txWhere(w)} group by 1`,
			),
		]);
		const map = (
			rows: Row[],
			key: "events" | "newIssues" | "transactions",
		): Counts[] =>
			rows.map((r) => ({
				bucket: new Date(r.bucket as Date | string),
				[key]: toInt(r.n),
			}));
		return [
			...map(events.rows as Row[], "events"),
			...map(issues.rows as Row[], "newIssues"),
			...map(txs.rows as Row[], "transactions"),
		];
	}

	/** Reparto de eventos por una columna (`level`, `environment` o `release`); los nulos cuentan como "sin dato". */
	async breakdown(
		w: Window,
		column: "level" | "environment" | "release",
	): Promise<Array<{ key: string; count: number }>> {
		const col = sql.raw(`e.${column}`);
		const r = (
			await this.db.execute(sql`
			select coalesce(${col}, '') as key, count(*)::int as n from event e
			where ${this.eventWhere(w)} group by 1 order by n desc, key limit 50`)
		).rows as Row[];
		return r.map((row) => ({ key: row.key as string, count: toInt(row.n) }));
	}

	async topIssues(w: Window, limit: number) {
		const r = (
			await this.db.execute(sql`
			select i.id::text, i.title, i.level, i.status, t.events, t.users
			from (
				select e.issue_id, count(*)::int as events, count(distinct e.user_identifier)::int as users
				from event e where ${this.eventWhere(w)} group by e.issue_id order by events desc limit ${limit}
			) t join issue i on i.id = t.issue_id
			order by t.events desc, i.title`)
		).rows as Row[];
		return r.map((row) => ({
			id: row.id as string,
			title: row.title as string,
			level: row.level as string,
			status: row.status as IssueStatus,
			events: toInt(row.events),
			users: toInt(row.users),
		}));
	}

	async slowest(w: Window, limit: number) {
		const r = (
			await this.db.execute(sql`
			select x.name, x.op, count(*)::int as n,
			       percentile_cont(0.95) within group (order by x.duration_ms) as p95
			from perf_transaction x where ${this.txWhere(w)}
			group by x.name, x.op order by p95 desc, x.name limit ${limit}`)
		).rows as Row[];
		return r.map((row) => ({
			name: row.name as string,
			op: row.op as string,
			count: toInt(row.n),
			p95: Math.round(Number(row.p95) * 100) / 100,
		}));
	}
}
