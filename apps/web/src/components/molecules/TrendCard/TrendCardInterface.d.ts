import type { StatsDto, StatsPeriod } from "@sentinel/shared";

export interface TrendCardProps {
	title: string;
	period: StatsPeriod;
	onPeriodChange: (period: StatsPeriod) => void;
	stats: StatsDto | undefined;
	isError: boolean;
	onRetry: () => void;
}
