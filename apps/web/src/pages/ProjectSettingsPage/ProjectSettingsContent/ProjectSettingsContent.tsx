import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/atoms/Skeleton/Skeleton";
import { Section } from "@/components/molecules/Section/Section";
import { DeleteProjectSection } from "@/components/organisms/DeleteProjectSection/DeleteProjectSection";
import { InstallInstructions } from "@/components/organisms/InstallInstructions/InstallInstructions";
import { JiraIntegrationForm } from "@/components/organisms/JiraIntegrationForm/JiraIntegrationForm";
import { ProjectGeneralForm } from "@/components/organisms/ProjectGeneralForm/ProjectGeneralForm";
import { ProjectKeysManager } from "@/components/organisms/ProjectKeysManager/ProjectKeysManager";
import { ProjectLimitsForm } from "@/components/organisms/ProjectLimitsForm/ProjectLimitsForm";
import { SettingsNav } from "@/components/organisms/SettingsNav/SettingsNav";
import { PageTemplate } from "@/components/templates/PageTemplate/PageTemplate";
import { useProject } from "@/hooks/useProjects/useProjects";
import { useCurrentProject } from "@/hooks/useScope/useScope";
import { useSettingsSearch } from "@/hooks/useSearchParams/useSearchParams";

export function ProjectSettingsContent() {
	const { t } = useTranslation();
	const { organization, project: listed } = useCurrentProject();
	const { search, update } = useSettingsSearch();
	// El detalle trae las claves DSN; la lista de proyectos no.
	const detail = useProject(organization?.id, listed?.id);
	const project = detail.data;

	if (!organization) return null;
	const firstActive =
		project?.keys?.find((k) => k.isActive) ?? project?.keys?.[0];

	return (
		<PageTemplate title={t("settings.title")} description={listed?.name}>
			{!project ? (
				<Skeleton className="h-64 w-full" />
			) : (
				<div className="flex flex-col gap-5 md:flex-row md:items-start md:gap-8">
					<SettingsNav
						current={search.section}
						onSelect={(section) => update({ section })}
					/>
					<div className="min-w-0 max-w-3xl flex-1 space-y-5">
						{search.section === "general" && (
							<ProjectGeneralForm project={project} orgId={organization.id} />
						)}
						{search.section === "keys" && (
							<>
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
							</>
						)}
						{search.section === "limits" && (
							<ProjectLimitsForm project={project} orgId={organization.id} />
						)}
						{search.section === "integrations" && (
							<JiraIntegrationForm project={project} orgId={organization.id} />
						)}
						{search.section === "danger" && (
							<DeleteProjectSection
								project={project}
								orgId={organization.id}
								orgSlug={organization.slug}
							/>
						)}
					</div>
				</div>
			)}
		</PageTemplate>
	);
}
