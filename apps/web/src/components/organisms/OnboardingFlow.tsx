import type { ProjectDto } from "@sentinel/shared";
import { useNavigate } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/atoms/Button/Button";
import { cn } from "@/utils/cn/cn";
import type { Organization } from "@/utils/organization/organizationInterface";
import { writeStorage } from "@/utils/storage/storage";
import { LAST_ORG_KEY } from "@/utils/storage/storage.constants";
import { CreateOrganizationForm } from "./CreateOrganizationForm";
import { CreateProjectForm } from "./CreateProjectForm";
import { InstallInstructions } from "./InstallInstructions";

const STEPS = ["org", "project", "install"] as const;

/** Alta guiada: organización, primer proyecto y cómo instalar el SDK con su DSN. */
export function OnboardingFlow() {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const [organization, setOrganization] = useState<Organization>();
	const [project, setProject] = useState<ProjectDto>();
	const step = !organization ? 0 : !project ? 1 : 2;

	return (
		<div data-testid="onboarding">
			<ol className="mb-6 flex items-center gap-2 text-xs">
				{STEPS.map((id, i) => (
					<li key={id} className="flex items-center gap-2">
						<span
							className={cn(
								"flex size-5 items-center justify-center rounded-full text-[11px] font-semibold",
								i < step
									? "bg-success text-white"
									: i === step
										? "bg-primary text-white"
										: "bg-border text-muted",
							)}
						>
							{i < step ? <Check className="size-3" /> : i + 1}
						</span>
						<span
							className={
								i === step ? "font-medium text-foreground" : "text-muted"
							}
						>
							{t(`onboarding.steps.${id}`)}
						</span>
						{i < STEPS.length - 1 && (
							<span aria-hidden className="mx-1 h-px w-6 bg-border" />
						)}
					</li>
				))}
			</ol>

			{step === 0 && (
				<section aria-labelledby="step-org">
					<h2 id="step-org" className="text-base font-semibold">
						{t("onboarding.org.title")}
					</h2>
					<p className="mt-1 mb-4 text-sm text-muted">
						{t("onboarding.org.description")}
					</p>
					<CreateOrganizationForm onCreated={setOrganization} />
				</section>
			)}

			{step === 1 && organization && (
				<section aria-labelledby="step-project">
					<h2 id="step-project" className="text-base font-semibold">
						{t("onboarding.project.title")}
					</h2>
					<p className="mt-1 mb-4 text-sm text-muted">
						{t("onboarding.project.description")}
					</p>
					<CreateProjectForm
						orgId={organization.id}
						placeholder={t("onboarding.project.placeholder")}
						onCreated={setProject}
					/>
				</section>
			)}

			{step === 2 && organization && project && (
				<section aria-labelledby="step-install">
					<h2 id="step-install" className="text-base font-semibold">
						{t("onboarding.install.title")}
					</h2>
					<p className="mt-1 mb-4 text-sm text-muted">
						{t("onboarding.install.description")}
					</p>
					<InstallInstructions dsn={project.keys?.[0]?.dsn ?? ""} />
					<Button
						variant="primary"
						className="mt-6"
						onClick={() => {
							writeStorage(LAST_ORG_KEY, organization.slug);
							navigate({
								to: "/$orgSlug/projects/$projectSlug/issues",
								params: {
									orgSlug: organization.slug,
									projectSlug: project.slug,
								},
							});
						}}
					>
						{t("onboarding.install.cta")}
					</Button>
				</section>
			)}
		</div>
	);
}
