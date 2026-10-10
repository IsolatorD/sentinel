import { useTranslation } from "react-i18next";
import { Card } from "@/components/atoms/Card/Card";
import { BarChart } from "@/components/molecules/BarChart/BarChart";
import type { OverviewChartsProps } from "@/components/organisms/OverviewCharts/OverviewChartsInterface";

/** Eventos y transacciones por intervalo; un pico se ve de un vistazo y la barra dice su fecha y su total. */
export function OverviewCharts({ data }: OverviewChartsProps) {
	const { t } = useTranslation();
	const events = data.series.map((p) => ({
		start: p.start,
		events: p.events,
		users: 0,
	}));
	const transactions = data.series.map((p) => ({
		start: p.start,
		events: p.transactions,
		users: 0,
	}));
	return (
		<div className="grid gap-3 lg:grid-cols-2" data-testid="overview-charts">
			<Card className="p-4">
				<h3 className="mb-3 text-sm font-semibold text-foreground">
					{t("overview.charts.events")}
				</h3>
				{data.totals.events === 0 ? (
					<p className="py-10 text-center text-sm text-muted">
						{t("overview.noData")}
					</p>
				) : (
					<BarChart
						points={events}
						bucketMinutes={data.bucketMinutes}
						label={t("overview.charts.events")}
					/>
				)}
			</Card>
			<Card className="p-4">
				<h3 className="mb-3 text-sm font-semibold text-foreground">
					{t("overview.charts.transactions")}
				</h3>
				{data.totals.transactions === 0 ? (
					<p className="py-10 text-center text-sm text-muted">
						{t("overview.noData")}
					</p>
				) : (
					<BarChart
						points={transactions}
						bucketMinutes={data.bucketMinutes}
						label={t("overview.charts.transactions")}
						format={(count) =>
							t("performance.summary.transactionsCount", { count })
						}
					/>
				)}
			</Card>
		</div>
	);
}
