import { useTranslation } from "react-i18next";
import { Button } from "@/components/atoms/Button/Button";
import { Card } from "@/components/atoms/Card/Card";
import { Skeleton } from "@/components/atoms/Skeleton/Skeleton";
import { BarChart } from "@/components/molecules/BarChart/BarChart";
import { PeriodSwitch } from "@/components/molecules/PeriodSwitch/PeriodSwitch";
import type { TrendCardProps } from "@/components/molecules/TrendCard/TrendCardInterface";

/** Tarjeta con el total de eventos del periodo, el selector de periodo y el gráfico. */
export function TrendCard({
	title,
	period,
	onPeriodChange,
	stats,
	isError,
	onRetry,
}: TrendCardProps) {
	const { t } = useTranslation();
	return (
		<Card className="p-4" data-testid="trend-card">
			<div className="mb-3 flex flex-wrap items-center justify-between gap-2">
				<div>
					<h2 className="text-sm font-semibold text-foreground">{title}</h2>
					{stats && (
						<p className="text-xs text-muted tabular-nums">
							{t("trend.events", { count: stats.totalEvents })}
						</p>
					)}
				</div>
				<PeriodSwitch value={period} onChange={onPeriodChange} />
			</div>
			{isError ? (
				<div className="flex items-center justify-between gap-3 text-sm text-muted">
					<span>{t("trend.loadError")}</span>
					<Button onClick={onRetry}>{t("common.retry")}</Button>
				</div>
			) : !stats ? (
				<Skeleton className="h-32 w-full" />
			) : stats.totalEvents === 0 ? (
				<p className="py-10 text-center text-sm text-muted">
					{t("trend.empty")}
				</p>
			) : (
				<BarChart
					points={stats.points}
					bucketMinutes={stats.bucketMinutes}
					label={t("trend.chartLabel", {
						period: t(`trend.period.${period}`),
					})}
				/>
			)}
		</Card>
	);
}
