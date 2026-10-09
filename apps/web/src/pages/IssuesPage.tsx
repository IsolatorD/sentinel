import { useTranslation } from "react-i18next";
import { IssueFilters } from "@/components/organisms/IssueFilters";
import { IssueList } from "@/components/organisms/IssueList";
import { PageTemplate } from "@/components/templates/PageTemplate";
import { useCurrentProject } from "@/hooks/useScope/useScope";
import { ProjectGate } from "./ProjectGate";

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
