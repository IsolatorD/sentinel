import { PERIOD_CONFIG, type StatsPeriod } from "@sentinel/shared";

const HOUR_MS = 3_600_000;

export interface BucketRange {
	/** Inicio del primer intervalo. */
	from: Date;
	/** Fin de la ventana (ahora). */
	to: Date;
	bucketMs: number;
	/** Cuántos intervalos cubre la ventana. */
	count: number;
}

/**
 * Ventana de un gráfico: termina en el intervalo que contiene `now` y retrocede hasta cubrir el
 * periodo. Los intervalos se alinean a múltiplos de su tamaño desde el origen UTC, igual que
 * `date_bin` en la base de datos: así lo que se agrupa allí coincide con las casillas de aquí.
 */
export function bucketRange(now: Date, period: StatsPeriod): BucketRange {
	const { hours, bucketHours } = PERIOD_CONFIG[period];
	const bucketMs = bucketHours * HOUR_MS;
	const count = Math.ceil(hours / bucketHours);
	const currentStart = Math.floor(now.getTime() / bucketMs) * bucketMs;
	return {
		from: new Date(currentStart - (count - 1) * bucketMs),
		to: now,
		bucketMs,
		count,
	};
}

export interface BucketRow {
	bucket: Date;
	events: number;
	users: number;
}

export interface FilledPoint {
	start: string;
	events: number;
	users: number;
}

/** Completa con ceros los intervalos sin eventos para que la serie sea continua y ordenada. */
export function fillBuckets(
	rows: BucketRow[],
	range: BucketRange,
): FilledPoint[] {
	const byStart = new Map(rows.map((r) => [r.bucket.getTime(), r]));
	return Array.from({ length: range.count }, (_, i) => {
		const start = range.from.getTime() + i * range.bucketMs;
		const row = byStart.get(start);
		return {
			start: new Date(start).toISOString(),
			events: row?.events ?? 0,
			users: row?.users ?? 0,
		};
	});
}
