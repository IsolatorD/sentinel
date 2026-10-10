import { useTranslation } from "react-i18next";
import { Button } from "@/components/atoms/Button/Button";
import { Card } from "@/components/atoms/Card/Card";
import { Skeleton } from "@/components/atoms/Skeleton/Skeleton";
import { LatencyChart } from "@/components/molecules/LatencyChart/LatencyChart";
import { StatBlock } from "@/components/molecules/StatBlock/StatBlock";
import type { PerformanceOverviewProps } from "@/components/organisms/PerformanceOverview/PerformanceOverviewInterface";
import { WebVitalsPanel } from "@/components/organisms/WebVitalsPanel/WebVitalsPanel";
import { usePerformanceOverview } from "@/hooks/usePerformance/usePerformance";
import { useCurrentProject } from "@/hooks/useScope/useScope";
import {
	formatMs,
	formatPercent,
	formatPerMinute,
} from "@/utils/performance/performance";
import { formatCompact } from "@/utils/time/time";

/** Resumen del periodo (percentiles, errores, throughput), gráfico de latencia y Web Vitals. */
export function PerformanceOverview({
	query,
	showVitals = true,
}: PerformanceOverviewProps) {
	const { t, i18n } = useTranslation();
	const { scope } = useCurrentProject();
	const overview = usePerformanceOverview(scope, query);
	const data = overview.data;
	const locale = i18n.language;

	if (overview.isError)
		return (
			<Card className="flex items-center justify-between gap-3 p-4 text-sm text-muted">
				<span>{t("performance.overview.loadError")}</span>
				<Button onClick={() => overview.refetch()}>{t("common.retry")}</Button>
			</Card>
		);

	return (
		<div
			className="space-y-4"
			data-testid="performance-overview"
			data-tour="performance-overview"
		>
			<Card className="p-4">
				{!data ? (
					<Skeleton className="h-52 w-full" />
				) : (
					<>
						<div className="mb-4 flex flex-wrap gap-x-8 gap-y-3">
							<StatBlock label={t("performance.summary.transactions")}>
								{formatCompact(data.summary.count, locale)}
							</StatBlock>
							<StatBlock label={t("performance.summary.p50")}>
								{formatMs(data.summary.p50, locale)}
							</StatBlock>
							<StatBlock label={t("performance.summary.p95")}>
								{formatMs(data.summary.p95, locale)}
							</StatBlock>
							<StatBlock label={t("performance.summary.p99")}>
								{formatMs(data.summary.p99, locale)}
							</StatBlock>
							<StatBlock label={t("performance.summary.errorRate")}>
								{formatPercent(data.summary.errorRate, locale)}
							</StatBlock>
							<StatBlock label={t("performance.summary.throughput")}>
								{t("performance.summary.perMinute", {
									value: formatPerMinute(data.summary.tpm, locale),
								})}
							</StatBlock>
						</div>
						{data.summary.count === 0 ? (
							<p className="py-10 text-center text-sm text-muted">
								{t("performance.overview.empty")}
							</p>
						) : (
							<LatencyChart
								points={data.points}
								bucketMinutes={data.bucketMinutes}
								label={t("performance.chart.label")}
							/>
						)}
					</>
				)}
			</Card>
			{showVitals && data && <WebVitalsPanel vitals={data.vitals} />}
		</div>
	);
}
