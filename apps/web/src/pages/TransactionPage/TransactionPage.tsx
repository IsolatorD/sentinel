import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { PeriodSwitch } from "@/components/molecules/PeriodSwitch/PeriodSwitch";
import { TabBar } from "@/components/molecules/TabBar/TabBar";
import { PerformanceOverview } from "@/components/organisms/PerformanceOverview/PerformanceOverview";
import { SamplesTable } from "@/components/organisms/SamplesTable/SamplesTable";
import { PageTemplate } from "@/components/templates/PageTemplate/PageTemplate";
import { useCurrentProject } from "@/hooks/useScope/useScope";
import { useTransactionSearch } from "@/hooks/useSearchParams/useSearchParams";
import { NotFoundPage } from "@/pages/NotFoundPage/NotFoundPage";
import { ProjectGate } from "@/pages/ProjectGate/ProjectGate";

/** Una transacción concreta (por nombre): su latencia en el tiempo y ejemplos para abrir su cascada. */
export function TransactionPage() {
	const { t } = useTranslation();
	const { organization, project } = useCurrentProject();
	const { search, update } = useTransactionSearch();

	if (!search.name) return <NotFoundPage />;
	const { name } = search;
	return (
		<ProjectGate>
			<PageTemplate
				eyebrow={
					organization &&
					project && (
						<Link
							to="/$orgSlug/projects/$projectSlug/performance"
							params={{ orgSlug: organization.slug, projectSlug: project.slug }}
							search={{
								period: search.period === "24h" ? undefined : search.period,
								environment: search.environment,
								release: search.release,
							}}
							className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
						>
							<ArrowLeft aria-hidden className="size-4" />
							{t("performance.transaction.back")}
						</Link>
					)
				}
				title={<span className="break-all">{name}</span>}
				description={project?.name}
				actions={
					<PeriodSwitch
						value={search.period}
						onChange={(period) => update({ period })}
					/>
				}
			>
				<div className="space-y-4">
					<PerformanceOverview
						showVitals={false}
						query={{
							name,
							period: search.period,
							environment: search.environment,
							release: search.release,
						}}
					/>
					<section className="space-y-3">
						<TabBar
							label={t("performance.transaction.samples")}
							active={search.samples}
							onChange={(samples) =>
								update({ samples: samples as typeof search.samples })
							}
							tabs={(["slowest", "recent"] as const).map((id) => ({
								id,
								label: t(`performance.transaction.${id}`),
							}))}
						/>
						<SamplesTable
							name={name}
							period={search.period}
							environment={search.environment}
							release={search.release}
							sort={search.samples}
						/>
					</section>
				</div>
			</PageTemplate>
		</ProjectGate>
	);
}
