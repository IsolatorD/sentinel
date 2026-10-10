import type { BucketRange } from "../issues/stats/stats.domain.js";

/** Variación respecto al periodo anterior en %; `null` si antes no hubo nada (no hay base para comparar). */
export function changePercent(
	current: number,
	previous: number,
): number | null {
	if (previous === 0) return null;
	return Math.round(((current - previous) / previous) * 1000) / 10;
}

export interface Counts {
	bucket: Date;
	events?: number;
	newIssues?: number;
	transactions?: number;
}

export interface DashboardPoint {
	start: string;
	events: number;
	newIssues: number;
	transactions: number;
}

/** Une las tres series (que salen de tablas distintas) en una sola, con todos los intervalos de la ventana. */
export function mergeSeries(
	rows: Counts[],
	range: BucketRange,
): DashboardPoint[] {
	const byStart = new Map<number, DashboardPoint>();
	for (let i = 0; i < range.count; i++) {
		const start = range.from.getTime() + i * range.bucketMs;
		byStart.set(start, {
			start: new Date(start).toISOString(),
			events: 0,
			newIssues: 0,
			transactions: 0,
		});
	}
	for (const row of rows) {
		const point = byStart.get(row.bucket.getTime());
		if (!point) continue; // fuera de la ventana
		point.events += row.events ?? 0;
		point.newIssues += row.newIssues ?? 0;
		point.transactions += row.transactions ?? 0;
	}
	return [...byStart.values()];
}

/** Agrupa lo que sobra del reparto en "otros" para que la lista no crezca sin fin. */
export function topWithOthers<T extends { key: string; count: number }>(
	items: T[],
	limit: number,
	othersKey = "other",
): Array<{ key: string; count: number }> {
	if (items.length <= limit) return items;
	const rest = items.slice(limit).reduce((sum, item) => sum + item.count, 0);
	return [...items.slice(0, limit), { key: othersKey, count: rest }];
}
