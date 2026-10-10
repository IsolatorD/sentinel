import { useTranslation } from "react-i18next";
import { PerformanceFilters } from "@/components/organisms/PerformanceFilters/PerformanceFilters";
import { PerformanceOverview } from "@/components/organisms/PerformanceOverview/PerformanceOverview";
import { QuotaBanner } from "@/components/organisms/QuotaBanner/QuotaBanner";
import { TransactionsTable } from "@/components/organisms/TransactionsTable/TransactionsTable";
import { PageTemplate } from "@/components/templates/PageTemplate/PageTemplate";
import { useTransactions } from "@/hooks/usePerformance/usePerformance";
import { useCurrentProject } from "@/hooks/useScope/useScope";
import { usePerformanceSearch } from "@/hooks/useSearchParams/useSearchParams";
import { useTour } from "@/hooks/useTour/useTour";
import { ProjectGate } from "@/pages/ProjectGate/ProjectGate";

export function PerformancePage() {
	const { t } = useTranslation();
	const { project, scope } = useCurrentProject();
	const { search } = usePerformanceSearch();
	// Solo se explica la pantalla cuando ya tiene algo que enseñar.
	const transactions = useTransactions(scope, { period: search.period });
	useTour("performance", { ready: (transactions.data?.total ?? 0) > 0 });
	return (
		<ProjectGate>
			<PageTemplate title={t("performance.title")} description={project?.name}>
				<div className="space-y-4">
					<p className="text-sm text-muted">{t("performance.subtitle")}</p>
					<QuotaBanner />
					<PerformanceFilters />
					<PerformanceOverview
						query={{
							period: search.period,
							environment: search.environment,
							release: search.release,
						}}
					/>
					<TransactionsTable />
				</div>
			</PageTemplate>
		</ProjectGate>
	);
}
