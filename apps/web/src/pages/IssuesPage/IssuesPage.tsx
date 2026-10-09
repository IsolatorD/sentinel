import { useTranslation } from "react-i18next";
import { IssueFilters } from "@/components/organisms/IssueFilters/IssueFilters";
import { IssueList } from "@/components/organisms/IssueList/IssueList";
import { PageTemplate } from "@/components/templates/PageTemplate/PageTemplate";
import { useCurrentProject } from "@/hooks/useScope/useScope";
import { ProjectGate } from "@/pages/ProjectGate/ProjectGate";

export function IssuesPage() {
	const { t } = useTranslation();
	const { project } = useCurrentProject();
	return (
		<ProjectGate>
			<PageTemplate title={t("issues.title")} description={project?.name}>
				<div className="space-y-4">
					<IssueFilters />
					<IssueList />
				</div>
			</PageTemplate>
		</ProjectGate>
	);
}
