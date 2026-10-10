import {
	PERIOD_CONFIG,
	rateVital,
	type StatsPeriod,
	type WaterfallSpan,
	WEB_VITALS,
	type WebVital,
} from "@sentinel/shared";
import type { BucketRange } from "../issues/stats/stats.domain.js";

/** Fracción de transacciones con error (0–1); 0 si no hubo ninguna. */
export function errorRate(errors: number, count: number): number {
	return count === 0 ? 0 : errors / count;
}

/** Transacciones por minuto promediadas sobre todo el periodo. */
export function throughputPerMinute(
	count: number,
	period: StatsPeriod,
): number {
	return count / (PERIOD_CONFIG[period].hours * 60);
}

/** Los percentiles de Postgres llegan como número o texto; una ventana vacía los deja en null. */
export function toMs(value: unknown): number | null {
	if (value === null || value === undefined) return null;
	const n = Number(value);
	return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

export interface SeriesRow {
	bucket: Date;
	count: number;
	errors: number;
	p50: number | null;
	p95: number | null;
}

export interface SeriesPoint {
	start: string;
	count: number;
	errors: number;
	p50: number | null;
	p95: number | null;
}

/** Serie continua: los intervalos sin transacciones traen cero y percentiles nulos (hueco en la línea). */
export function fillSeries(
	rows: SeriesRow[],
	range: BucketRange,
): SeriesPoint[] {
	const byStart = new Map(rows.map((r) => [r.bucket.getTime(), r]));
	return Array.from({ length: range.count }, (_, i) => {
		const start = range.from.getTime() + i * range.bucketMs;
		const row = byStart.get(start);
		return {
			start: new Date(start).toISOString(),
			count: row?.count ?? 0,
			errors: row?.errors ?? 0,
			p50: row?.p50 ?? null,
			p95: row?.p95 ?? null,
		};
	});
}

export interface VitalRow {
	vital: WebVital;
	p75: number | null;
	samples: number;
}

/** Solo los vitals con muestras, cada uno con su valoración (bueno / mejorable / malo). */
export function summarizeVitals(rows: VitalRow[]) {
	const out: Partial<
		Record<
			WebVital,
			{ p75: number; samples: number; rating: ReturnType<typeof rateVital> }
		>
	> = {};
	for (const vital of WEB_VITALS) {
		const row = rows.find((r) => r.vital === vital);
		if (!row || row.samples === 0 || row.p75 === null) continue;
		out[vital] = {
			p75: row.p75,
			samples: row.samples,
			rating: rateVital(vital, row.p75),
		};
	}
	return out;
}

export interface SpanRow {
	spanId: string;
	parentSpanId: string | null;
	op: string;
	description: string | null;
	startMs: number;
	durationMs: number;
	status: string | null;
	data: Record<string, unknown> | null;
}

/**
 * Ordena los spans por inicio y calcula el desfase respecto a la transacción y el nivel de
 * anidación (1 = hijo directo). Un span cuyo padre no existe cuelga de la transacción.
 */
export function buildWaterfall(
	txStartMs: number,
	spans: SpanRow[],
): WaterfallSpan[] {
	const byId = new Map(spans.map((s) => [s.spanId, s]));
	const depthOf = (span: SpanRow): number => {
		let depth = 1;
		let current = span;
		const seen = new Set<string>([span.spanId]);
		while (current.parentSpanId) {
			const parent = byId.get(current.parentSpanId);
			// Padre desconocido o ciclo (datos corruptos): se corta aquí.
			if (!parent || seen.has(parent.spanId)) break;
			seen.add(parent.spanId);
			current = parent;
			depth++;
		}
		return depth;
	};
	return spans
		.map((span) => ({
			spanId: span.spanId,
			parentSpanId: span.parentSpanId,
			op: span.op,
			description: span.description,
			offsetMs: Math.max(0, span.startMs - txStartMs),
			durationMs: span.durationMs,
			status: span.status,
			depth: depthOf(span),
			data: span.data,
		}))
		.sort((a, b) => a.offsetMs - b.offsetMs || a.depth - b.depth);
}
