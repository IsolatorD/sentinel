import type { StatsDto } from "@sentinel/shared";

export interface BarChartProps {
	points: StatsDto["points"];
	bucketMinutes: number;
	/** Descripción para lectores de pantalla. */
	label: string;
}
