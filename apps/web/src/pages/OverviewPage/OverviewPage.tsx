import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/atoms/Skeleton/Skeleton";
import { BreakdownCard } from "@/components/molecules/BreakdownCard/BreakdownCard";
import { ErrorState } from "@/components/molecules/ErrorState/ErrorState";
import { LEVEL_BAR } from "@/components/molecules/IssueListItem/IssueListItem.constants";
import { PeriodSwitch } from "@/components/molecules/PeriodSwitch/PeriodSwitch";
import { OverviewCharts } from "@/components/organisms/OverviewCharts/OverviewCharts";
import { OverviewTiles } from "@/components/organisms/OverviewTiles/OverviewTiles";
import { QuotaBanner } from "@/components/organisms/QuotaBanner/QuotaBanner";
import { SlowestCard } from "@/components/organisms/SlowestCard/SlowestCard";
import { TopIssuesCard } from "@/components/organisms/TopIssuesCard/TopIssuesCard";
import { PageTemplate } from "@/components/templates/PageTemplate/PageTemplate";
import { useDashboard } from "@/hooks/useDashboard/useDashboard";
import { useCurrentProject } from "@/hooks/useScope/useScope";
import { useOverviewSearch } from "@/hooks/useSearchParams/useSearchParams";
import { ProjectGate } from "@/pages/ProjectGate/ProjectGate";

/** Resumen del proyecto: cuánto pasa, cómo evoluciona y qué mirar primero. */
export function OverviewPage() {
	const { t } = useTranslation();
	const { project, scope } = useCurrentProject();
	const { search, update } = useOverviewSearch();
	const dashboard = useDashboard(scope, {
		period: search.period,
		environment: search.environment,
	});
	const data = dashboard.data;

	return (
		<ProjectGate>
			<PageTemplate
				title={t("overview.title")}
				description={project?.name}
				actions={
					<PeriodSwitch
						value={search.period}
						onChange={(period) => update({ period })}
					/>
				}
			>
				<div className="space-y-4">
					<QuotaBanner />
					{dashboard.isError ? (
						<ErrorState
							title={t("overview.loadError")}
							onRetry={() => dashboard.refetch()}
						/>
					) : !data ? (
						<div className="space-y-4">
							<Skeleton className="h-24 w-full" />
							<Skeleton className="h-56 w-full" />
						</div>
					) : (
						<>
							<OverviewTiles data={data} />
							<OverviewCharts data={data} />
							<div className="grid gap-3 lg:grid-cols-3">
								<BreakdownCard
									testId="by-level"
									title={t("overview.byLevel")}
									items={data.byLevel}
									labelOf={(key) =>
										t(`issues.levels.${key}` as "issues.levels.error", {
											defaultValue: key,
										})
									}
									colorOf={(key) => LEVEL_BAR[key] ?? "bg-debug"}
								/>
								<BreakdownCard
									testId="by-environment"
									title={t("overview.byEnvironment")}
									items={data.byEnvironment}
									labelOf={(key) =>
										key === ""
											? t("overview.unknown")
											: key === "other"
												? t("overview.other")
												: key
									}
								/>
								<BreakdownCard
									testId="by-release"
									title={t("overview.byRelease")}
									items={data.byRelease}
									labelOf={(key) =>
										key === ""
											? t("overview.unknown")
											: key === "other"
												? t("overview.other")
												: key
									}
								/>
							</div>
							<div className="grid gap-3 lg:grid-cols-2">
								<TopIssuesCard issues={data.topIssues} />
								<SlowestCard items={data.slowest} period={search.period} />
							</div>
						</>
					)}
				</div>
			</PageTemplate>
		</ProjectGate>
	);
}
