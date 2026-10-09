import { useTranslation } from "react-i18next";
import { TabBar } from "@/components/molecules/TabBar/TabBar";
import { AlertChannelsManager } from "@/components/organisms/AlertChannelsManager/AlertChannelsManager";
import { AlertDeliveriesTable } from "@/components/organisms/AlertDeliveriesTable/AlertDeliveriesTable";
import { AlertRulesManager } from "@/components/organisms/AlertRulesManager/AlertRulesManager";
import { PageTemplate } from "@/components/templates/PageTemplate/PageTemplate";
import { useCurrentProject } from "@/hooks/useScope/useScope";
import { useAlertsSearch } from "@/hooks/useSearchParams/useSearchParams";
import { TABS } from "@/pages/AlertsPage/AlertsContent/AlertsContent.constants";
import { PAGE_SIZE } from "@/utils/searchParams/searchParams.constants";
import type { AlertsSearch } from "@/utils/searchParams/searchParamsInterface";

export function AlertsContent() {
	const { t } = useTranslation();
	const { organization, project } = useCurrentProject();
	const { search, update } = useAlertsSearch();
	if (!organization || !project) return null;
	const scope = { orgId: organization.id, projectId: project.id };

	return (
		<PageTemplate
			title={t("alerts.title")}
			description={project.name}
			toolbar={
				<TabBar
					label={t("alerts.title")}
					active={search.tab}
					onChange={(tab) =>
						update({ tab: tab as AlertsSearch["tab"], page: 1 })
					}
					tabs={TABS.map((id) => ({ id, label: t(`alerts.tabs.${id}`) }))}
				/>
			}
		>
			<p className="mb-4 text-sm text-muted">{t("alerts.subtitle")}</p>
			<div key={search.tab} className="animate-fade-in">
				{search.tab === "rules" && <AlertRulesManager scope={scope} />}
				{search.tab === "channels" && <AlertChannelsManager scope={scope} />}
				{search.tab === "history" && (
					<AlertDeliveriesTable
						scope={scope}
						orgSlug={organization.slug}
						projectSlug={project.slug}
						offset={(search.page - 1) * PAGE_SIZE}
						onOffsetChange={(offset) =>
							update({ page: offset / PAGE_SIZE + 1 })
						}
					/>
				)}
			</div>
		</PageTemplate>
	);
}
