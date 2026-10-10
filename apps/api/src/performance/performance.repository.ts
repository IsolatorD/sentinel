import { Inject, Injectable } from "@nestjs/common";
import { type Database, sql } from "@sentinel/db";
import type { ListTransactionsQuery, WebVital } from "@sentinel/shared";
import { WEB_VITALS } from "@sentinel/shared";
import { DB } from "../database/database.module.js";
import type { SeriesRow, SpanRow, VitalRow } from "./performance.domain.js";
import { toMs } from "./performance.domain.js";

/** Origen de los intervalos de `date_bin` (medianoche UTC), el mismo que usa el resto de estadísticas. */
const ORIGIN = sql`timestamptz '2000-01-01 00:00:00+00'`;

export interface Filters {
	projectId: string;
	from: Date;
	environment?: string;
	release?: string;
	name?: string;
}

export interface GroupRow {
	name: string;
	op: string;
	count: number;
	p50: number | null;
	p95: number | null;
	p99: number | null;
	errors: number;
	lastSeen: Date;
}

export interface SummaryRow {
	count: number;
	errors: number;
	p50: number | null;
	p95: number | null;
	p99: number | null;
}

export interface SampleRow {
	id: string;
	traceId: string;
	timestamp: Date;
	durationMs: number;
	status: string;
	release: string | null;
	environment: string | null;
	user: string | null;
}

export interface SampleDetailRow extends SampleRow {
	projectId: string;
	name: string;
	op: string;
	spanId: string;
	platform: string | null;
	measurements: Record<string, { value: number; unit?: string }>;
	tags: Record<string, string>;
}

const where = (f: Filters) => {
	const conds = [
		sql`project_id = ${f.projectId}`,
		sql`"timestamp" >= ${f.from.toISOString()}::timestamptz`,
	];
	if (f.environment) conds.push(sql`environment = ${f.environment}`);
	if (f.release) conds.push(sql`release = ${f.release}`);
	if (f.name) conds.push(sql`name = ${f.name}`);
	return sql.join(conds, sql` and `);
};

const SORT_SQL: Record<ListTransactionsQuery["sort"], string> = {
	count: "count",
	p50: "p50",
	p95: "p95",
	// En ORDER BY un alias solo vale solo, no dentro de una expresión.
	errorRate: "(count(*) filter (where status <> 'ok'))::float / count(*)",
	tpm: "count",
	lastSeen: "last_seen",
};

export interface TraceTransactionRow extends SampleRow {
	name: string;
	op: string;
	platform: string | null;
	spanId: string;
	parentSpanId: string | null;
	parentTransactionId: string | null;
}

export interface TraceEventRow {
	id: string;
	issueId: string;
	issueTitle: string;
	level: string;
	timestamp: Date;
	platform: string | null;
	spanId: string | null;
}

type Row = Record<string, unknown>;

// Única capa que conoce Drizzle/SQL para el rendimiento.
@Injectable()
export class PerformanceRepository {
	constructor(@Inject(DB) private readonly db: Database) {}

	/** Transacciones agrupadas por nombre y tipo, con percentiles de duración. */
	async groups(
		f: Filters,
		query: Pick<
			ListTransactionsQuery,
			"q" | "sort" | "order" | "limit" | "offset"
		>,
	): Promise<{ items: GroupRow[]; total: number }> {
		const search = query.q
			? sql` and name ilike ${`%${query.q.replace(/[\\%_]/g, "\\$&")}%`}`
			: sql``;
		const direction = query.order === "asc" ? sql`asc` : sql`desc`;
		const result = await this.db.execute(sql`
			select name, op,
			       count(*)::int as count,
			       percentile_cont(0.5) within group (order by duration_ms) as p50,
			       percentile_cont(0.95) within group (order by duration_ms) as p95,
			       percentile_cont(0.99) within group (order by duration_ms) as p99,
			       (count(*) filter (where status <> 'ok'))::int as errors,
			       max("timestamp") as last_seen,
			       count(*) over () as total_groups
			from perf_transaction
			where ${where(f)}${search}
			group by name, op
			order by ${sql.raw(SORT_SQL[query.sort])} ${direction} nulls last, name asc
			limit ${query.limit} offset ${query.offset}`);
		const rows = result.rows as Row[];
		return {
			total:
				rows.length > 0
					? Number(rows[0].total_groups)
					: await this.countGroups(f, search),
			items: rows.map((r) => ({
				name: r.name as string,
				op: r.op as string,
				count: Number(r.count),
				p50: toMs(r.p50),
				p95: toMs(r.p95),
				p99: toMs(r.p99),
				errors: Number(r.errors),
				lastSeen: new Date(r.last_seen as Date | string),
			})),
		};
	}

	// Con un `offset` pasado el final no hay filas de las que leer el total.
	private async countGroups(f: Filters, search: ReturnType<typeof sql>) {
		const result = await this.db.execute(sql`
			select count(*)::int as n from (
				select 1 from perf_transaction where ${where(f)}${search} group by name, op
			) g`);
		return Number((result.rows as Row[])[0]?.n ?? 0);
	}

	async summary(f: Filters): Promise<SummaryRow> {
		const result = await this.db.execute(sql`
			select count(*)::int as count,
			       (count(*) filter (where status <> 'ok'))::int as errors,
			       percentile_cont(0.5) within group (order by duration_ms) as p50,
			       percentile_cont(0.95) within group (order by duration_ms) as p95,
			       percentile_cont(0.99) within group (order by duration_ms) as p99
			from perf_transaction where ${where(f)}`);
		const r = (result.rows as Row[])[0] ?? {};
		return {
			count: Number(r.count ?? 0),
			errors: Number(r.errors ?? 0),
			p50: toMs(r.p50),
			p95: toMs(r.p95),
			p99: toMs(r.p99),
		};
	}

	async series(f: Filters, bucketHours: number): Promise<SeriesRow[]> {
		const result = await this.db.execute(sql`
			select date_bin(${`${bucketHours} hours`}::interval, "timestamp", ${ORIGIN}) as bucket,
			       count(*)::int as count,
			       (count(*) filter (where status <> 'ok'))::int as errors,
			       percentile_cont(0.5) within group (order by duration_ms) as p50,
			       percentile_cont(0.95) within group (order by duration_ms) as p95
			from perf_transaction where ${where(f)}
			group by 1 order by 1`);
		return (result.rows as Row[]).map((r) => ({
			bucket: new Date(r.bucket as Date | string),
			count: Number(r.count),
			errors: Number(r.errors),
			p50: toMs(r.p50),
			p95: toMs(r.p95),
		}));
	}

	/** Percentil 75 y nº de muestras de cada Web Vital (solo las transacciones que lo midieron). */
	async vitals(f: Filters): Promise<VitalRow[]> {
		const columns = WEB_VITALS.map(
			(v) => sql`
				percentile_cont(0.75) within group (order by (measurements->${v}->>'value')::float)
					filter (where measurements ? ${v}) as ${sql.raw(`${v}_p75`)},
				(count(*) filter (where measurements ? ${v}))::int as ${sql.raw(`${v}_n`)}`,
		);
		const result = await this.db.execute(sql`
			select ${sql.join(columns, sql`, `)} from perf_transaction where ${where(f)}`);
		const r = (result.rows as Row[])[0] ?? {};
		return WEB_VITALS.map((vital: WebVital) => ({
			vital,
			p75: toMs(r[`${vital}_p75`]),
			samples: Number(r[`${vital}_n`] ?? 0),
		}));
	}

	async samples(
		f: Filters,
		sort: "slowest" | "recent",
		limit: number,
	): Promise<SampleRow[]> {
		const order =
			sort === "slowest"
				? sql`duration_ms desc, "timestamp" desc`
				: sql`"timestamp" desc`;
		const result = await this.db.execute(sql`
			select id::text, trace_id, "timestamp", duration_ms, status, release, environment, user_identifier
			from perf_transaction where ${where(f)}
			order by ${order} limit ${limit}`);
		return (result.rows as Row[]).map(toSample);
	}

	async sample(
		projectId: string,
		transactionId: string,
	): Promise<SampleDetailRow | undefined> {
		const result = await this.db.execute(sql`
			select id::text, project_id::text, trace_id, span_id, name, op, platform, "timestamp",
			       duration_ms, status, release, environment, user_identifier, measurements, tags
			from perf_transaction
			where project_id = ${projectId} and id = ${transactionId}::uuid`);
		const r = (result.rows as Row[])[0];
		if (!r) return undefined;
		return {
			...toSample(r),
			projectId: r.project_id as string,
			name: r.name as string,
			op: r.op as string,
			spanId: r.span_id as string,
			platform: (r.platform as string | null) ?? null,
			measurements: (r.measurements ?? {}) as SampleDetailRow["measurements"],
			tags: (r.tags ?? {}) as Record<string, string>,
		};
	}

	/** Todas las transacciones de una traza (varios servicios), por orden de inicio. */
	async traceTransactions(
		projectId: string,
		traceId: string,
	): Promise<TraceTransactionRow[]> {
		const result = await this.db.execute(sql`
			select x.id::text, x.trace_id, x.span_id, x.parent_span_id, x.name, x.op, x.platform, x."timestamp",
			       x.duration_ms, x.status, x.release, x.environment, x.user_identifier,
			       -- El padre puede ser otra transacción (su span raíz) o un span dentro de ella (una petición saliente).
			       coalesce(
			         (select p.id from perf_transaction p
			           where p.project_id = x.project_id and p.trace_id = x.trace_id
			             and p.span_id = x.parent_span_id and p.id <> x.id limit 1),
			         (select s.transaction_id from perf_span s
			           join perf_transaction p on p.id = s.transaction_id
			           where p.project_id = x.project_id and p.trace_id = x.trace_id
			             and s.span_id = x.parent_span_id limit 1)
			       )::text as parent_transaction_id
			from perf_transaction x
			where x.project_id = ${projectId} and x.trace_id = ${traceId}
			order by x."timestamp" asc, x.duration_ms desc
			limit 200`);
		return (result.rows as Row[]).map((r) => ({
			...toSample(r),
			name: r.name as string,
			op: r.op as string,
			platform: (r.platform as string | null) ?? null,
			spanId: r.span_id as string,
			parentSpanId: (r.parent_span_id as string | null) ?? null,
			parentTransactionId: (r.parent_transaction_id as string | null) ?? null,
		}));
	}

	/** Los errores capturados durante la traza, con el título de su issue. */
	async traceEvents(
		projectId: string,
		traceId: string,
	): Promise<TraceEventRow[]> {
		const result = await this.db.execute(sql`
			select e.id::text, e.issue_id::text, i.title as issue_title, e.level, e."timestamp", e.platform,
			       e.payload->'contexts'->'trace'->>'span_id' as span_id
			from event e join issue i on i.id = e.issue_id
			where e.project_id = ${projectId} and e.trace_id = ${traceId}
			order by e."timestamp" asc
			limit 100`);
		return (result.rows as Row[]).map((r) => ({
			id: r.id as string,
			issueId: r.issue_id as string,
			issueTitle: r.issue_title as string,
			level: r.level as string,
			timestamp: new Date(r.timestamp as Date | string),
			platform: (r.platform as string | null) ?? null,
			spanId: (r.span_id as string | null) ?? null,
		}));
	}

	async spans(transactionId: string): Promise<SpanRow[]> {
		const result = await this.db.execute(sql`
			select span_id, parent_span_id, op, description, start_timestamp, duration_ms, status, data
			from perf_span where transaction_id = ${transactionId}::uuid
			order by start_timestamp asc`);
		return (result.rows as Row[]).map((r) => ({
			spanId: r.span_id as string,
			parentSpanId: (r.parent_span_id as string | null) ?? null,
			op: r.op as string,
			description: (r.description as string | null) ?? null,
			startMs: new Date(r.start_timestamp as Date | string).getTime(),
			durationMs: Number(r.duration_ms),
			status: (r.status as string | null) ?? null,
			data: (r.data as Record<string, unknown> | null) ?? null,
		}));
	}
}

function toSample(r: Row): SampleRow {
	return {
		id: r.id as string,
		traceId: r.trace_id as string,
		timestamp: new Date(r.timestamp as Date | string),
		durationMs: Number(r.duration_ms),
		status: r.status as string,
		release: (r.release as string | null) ?? null,
		environment: (r.environment as string | null) ?? null,
		user: (r.user_identifier as string | null) ?? null,
	};
}
