import type { OverviewQuery } from "@sentinel/shared";

export interface PerformanceOverviewProps {
	query: Partial<OverviewQuery>;
	/** Muestra los Web Vitals debajo del gráfico. */
	showVitals?: boolean;
}
