import type { PerformanceOverviewDto } from "@sentinel/shared";

export interface LatencyChartProps {
	points: PerformanceOverviewDto["points"];
	bucketMinutes: number;
	/** Descripción para lectores de pantalla. */
	label: string;
}

/** Un valor por intervalo; `null` donde no hubo transacciones. */
export type Series = Array<number | null>;
