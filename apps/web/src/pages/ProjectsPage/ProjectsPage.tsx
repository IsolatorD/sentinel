import { useTranslation } from "react-i18next";
import { ProjectsList } from "@/components/organisms/ProjectsList/ProjectsList";
import { PageTemplate } from "@/components/templates/PageTemplate/PageTemplate";

export function ProjectsPage() {
	const { t } = useTranslation();
	return (
		<PageTemplate
			title={t("projects.title")}
			description={t("projects.subtitle")}
		>
			<ProjectsList />
		</PageTemplate>
	);
}
