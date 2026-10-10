import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/atoms/Skeleton/Skeleton";
import { Section } from "@/components/molecules/Section/Section";
import { DeleteProjectSection } from "@/components/organisms/DeleteProjectSection/DeleteProjectSection";
import { InstallInstructions } from "@/components/organisms/InstallInstructions/InstallInstructions";
import { ProjectGeneralForm } from "@/components/organisms/ProjectGeneralForm/ProjectGeneralForm";
import { ProjectKeysManager } from "@/components/organisms/ProjectKeysManager/ProjectKeysManager";
import { PageTemplate } from "@/components/templates/PageTemplate/PageTemplate";
import { useProject } from "@/hooks/useProjects/useProjects";
import { useCurrentProject } from "@/hooks/useScope/useScope";

export function ProjectSettingsContent() {
	const { t } = useTranslation();
	const { organization, project: listed } = useCurrentProject();
	// El detalle trae las claves DSN; la lista de proyectos no.
	const detail = useProject(organization?.id, listed?.id);
	const project = detail.data;

	if (!organization) return null;
	const firstActive =
		project?.keys?.find((k) => k.isActive) ?? project?.keys?.[0];

	return (
		<PageTemplate narrow title={t("settings.title")} description={listed?.name}>
			{!project ? (
				<Skeleton className="h-64 w-full" />
			) : (
				<div className="space-y-5">
					<ProjectGeneralForm project={project} orgId={organization.id} />
					<ProjectKeysManager project={project} orgId={organization.id} />
					{firstActive && (
						<Section title={t("settings.install.title")}>
							<p className="mb-4 text-sm text-muted">
								{t("settings.install.description")}
							</p>
							<InstallInstructions
								dsn={firstActive.dsn}
								platform={project.platform}
							/>
						</Section>
					)}
					<DeleteProjectSection
						project={project}
						orgId={organization.id}
						orgSlug={organization.slug}
					/>
				</div>
			)}
		</PageTemplate>
	);
}
