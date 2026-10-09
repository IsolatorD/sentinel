import { useTranslation } from "react-i18next";
import { ReleasesTable } from "@/components/organisms/ReleasesTable";
import { PageTemplate } from "@/components/templates/PageTemplate";
import { useCurrentProject } from "@/hooks/use-scope";
import { ProjectGate } from "./ProjectGate";

export function ReleasesPage() {
	const { t } = useTranslation();
	const { project } = useCurrentProject();
	return (
		<ProjectGate>
			<PageTemplate
				title={t("releases.title")}
				description={project?.name ?? t("releases.subtitle")}
			>
				<p className="mb-4 text-sm text-muted">{t("releases.subtitle")}</p>
				<ReleasesTable />
			</PageTemplate>
		</ProjectGate>
	);
}
