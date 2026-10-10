import { Inject, Injectable } from "@nestjs/common";
import { type Database, sql } from "@sentinel/db";
import { DB } from "../../database/database.module.js";
import type { BucketRow } from "./stats.domain.js";

/** Origen de los intervalos: `date_bin` alinea a múltiplos de su tamaño desde aquí (medianoche UTC). */
const ORIGIN = sql`timestamptz '2000-01-01 00:00:00+00'`;

// Única capa que conoce Drizzle para las estadísticas.
@Injectable()
export class StatsRepository {
	constructor(@Inject(DB) private readonly db: Database) {}

	/** Eventos y usuarios distintos por intervalo, de todo el proyecto. */
	async projectSeries(
		projectId: string,
		from: Date,
		bucketHours: number,
	): Promise<BucketRow[]> {
		const result = await this.db.execute(sql`
			select date_bin(${`${bucketHours} hours`}::interval, "timestamp", ${ORIGIN}) as bucket,
			       count(*)::int as events,
			       count(distinct user_identifier)::int as users
			from event
			where project_id = ${projectId} and "timestamp" >= ${from.toISOString()}::timestamptz
			group by 1
			order by 1`);
		return toRows(result.rows);
	}

	/** Lo mismo, para un solo issue. */
	async issueSeries(
		issueId: string,
		from: Date,
		bucketHours: number,
	): Promise<BucketRow[]> {
		const result = await this.db.execute(sql`
			select date_bin(${`${bucketHours} hours`}::interval, "timestamp", ${ORIGIN}) as bucket,
			       count(*)::int as events,
			       count(distinct user_identifier)::int as users
			from event
			where issue_id = ${issueId} and "timestamp" >= ${from.toISOString()}::timestamptz
			group by 1
			order by 1`);
		return toRows(result.rows);
	}

	/** Eventos por intervalo de varios issues a la vez (una sola consulta para toda una página del listado). */
	async issuesSeries(
		issueIds: string[],
		from: Date,
		bucketHours: number,
	): Promise<Map<string, BucketRow[]>> {
		if (issueIds.length === 0) return new Map();
		const result = await this.db.execute(sql`
			select issue_id::text as issue_id,
			       date_bin(${`${bucketHours} hours`}::interval, "timestamp", ${ORIGIN}) as bucket,
			       count(*)::int as events
			from event
			where issue_id = any(${sql`array[${sql.join(
				issueIds.map((id) => sql`${id}::uuid`),
				sql`, `,
			)}]`})
			  and "timestamp" >= ${from.toISOString()}::timestamptz
			group by 1, 2`);
		const byIssue = new Map<string, BucketRow[]>();
		for (const row of result.rows as Array<{
			issue_id: string;
			bucket: Date | string;
			events: number;
		}>) {
			const list = byIssue.get(row.issue_id) ?? [];
			list.push({ bucket: new Date(row.bucket), events: row.events, users: 0 });
			byIssue.set(row.issue_id, list);
		}
		return byIssue;
	}
}

function toRows(rows: Array<Record<string, unknown>>): BucketRow[] {
	return rows.map((r) => ({
		bucket: new Date(r.bucket as Date | string),
		events: Number(r.events),
		users: Number(r.users),
	}));
}
