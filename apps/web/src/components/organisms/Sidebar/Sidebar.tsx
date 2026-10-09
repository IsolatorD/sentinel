import {
	Bell,
	Bug,
	FolderKanban,
	KeyRound,
	Rocket,
	Settings,
	Users,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Logo } from "@/components/atoms/Logo/Logo";
import { SidebarLink } from "@/components/molecules/SidebarLink/SidebarLink";
import { OrgSwitcher } from "@/components/organisms/Sidebar/OrgSwitcher/OrgSwitcher";
import { ProjectSwitcher } from "@/components/organisms/Sidebar/ProjectSwitcher/ProjectSwitcher";
import { UserMenu } from "@/components/organisms/Sidebar/UserMenu/UserMenu";
import { useCurrentProject } from "@/hooks/useScope/useScope";
import { useTour } from "@/hooks/useTour/useTour";

export function Sidebar() {
	const { t } = useTranslation();
	const { organization, project } = useCurrentProject();
	// La bienvenida se lanza sola la primera vez; el menú de la persona permite repetirla.
	const { restart } = useTour("welcome", { ready: Boolean(organization) });

	return (
		<div
			className="flex h-full flex-col gap-4 bg-sidebar p-3"
			data-testid="sidebar"
		>
			<div className="px-2 pt-1 pb-1 text-white">
				<Logo markClassName="text-primary" />
			</div>
			<div className="space-y-2">
				<OrgSwitcher />
				<ProjectSwitcher />
			</div>
			{organization && (
				<nav
					aria-label={t("nav.main")}
					data-tour="main-nav"
					className="flex flex-col gap-0.5"
				>
					{project && (
						<>
							<SidebarLink
								icon={Bug}
								to="/$orgSlug/projects/$projectSlug/issues"
								params={{
									orgSlug: organization.slug,
									projectSlug: project.slug,
								}}
								activeOptions={{ exact: false }}
							>
								{t("nav.issues")}
							</SidebarLink>
							<SidebarLink
								icon={Rocket}
								to="/$orgSlug/projects/$projectSlug/releases"
								params={{
									orgSlug: organization.slug,
									projectSlug: project.slug,
								}}
							>
								{t("nav.releases")}
							</SidebarLink>
							<SidebarLink
								icon={Bell}
								to="/$orgSlug/projects/$projectSlug/alerts"
								params={{
									orgSlug: organization.slug,
									projectSlug: project.slug,
								}}
							>
								{t("nav.alerts")}
							</SidebarLink>
							<SidebarLink
								icon={Settings}
								to="/$orgSlug/projects/$projectSlug/settings"
								params={{
									orgSlug: organization.slug,
									projectSlug: project.slug,
								}}
							>
								{t("nav.settings")}
							</SidebarLink>
						</>
					)}
					<SidebarLink
						icon={FolderKanban}
						to="/$orgSlug/projects"
						params={{ orgSlug: organization.slug }}
						// Los proyectos individuales cuelgan de /projects: sin `exact` se resaltaría siempre.
						activeOptions={{ exact: true }}
					>
						{t("nav.projects")}
					</SidebarLink>
					<SidebarLink
						icon={Users}
						to="/$orgSlug/members"
						params={{ orgSlug: organization.slug }}
					>
						{t("nav.members")}
					</SidebarLink>
					<SidebarLink
						icon={KeyRound}
						to="/$orgSlug/tokens"
						params={{ orgSlug: organization.slug }}
					>
						{t("nav.tokens")}
					</SidebarLink>
				</nav>
			)}
			<div className="mt-auto border-t border-white/10 pt-3">
				<UserMenu onStartTour={restart} />
			</div>
		</div>
	);
}
