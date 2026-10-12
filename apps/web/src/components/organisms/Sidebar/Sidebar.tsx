import {
	Bell,
	Bug,
	FolderKanban,
	Gauge,
	KeyRound,
	LayoutDashboard,
	PanelLeftClose,
	PanelLeftOpen,
	Rocket,
	Settings,
	Users,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Logo } from "@/components/atoms/Logo/Logo";
import { LogoMark } from "@/components/atoms/LogoMark/LogoMark";
import { SidebarLink } from "@/components/molecules/SidebarLink/SidebarLink";
import { OrgSwitcher } from "@/components/organisms/Sidebar/OrgSwitcher/OrgSwitcher";
import { ProjectSwitcher } from "@/components/organisms/Sidebar/ProjectSwitcher/ProjectSwitcher";
import type { SidebarProps } from "@/components/organisms/Sidebar/SidebarInterface";
import { UserMenu } from "@/components/organisms/Sidebar/UserMenu/UserMenu";
import { useCurrentProject } from "@/hooks/useScope/useScope";
import { useTour } from "@/hooks/useTour/useTour";
import { cn } from "@/utils/cn/cn";

export function Sidebar({
	collapsed = false,
	onToggleCollapsed,
}: SidebarProps) {
	const { t } = useTranslation();
	const { organization, project } = useCurrentProject();
	// La bienvenida se lanza sola la primera vez; el menú de la persona permite repetirla.
	const { restart } = useTour("welcome", { ready: Boolean(organization) });

	return (
		<div
			className="flex h-full flex-col gap-4 overflow-hidden bg-sidebar p-3"
			data-testid="sidebar"
		>
			<div
				className={cn(
					"flex pt-1 pb-1 text-white",
					collapsed
						? "flex-col items-center gap-3"
						: "items-center justify-between px-2",
				)}
			>
				{collapsed ? (
					<LogoMark className="size-6 text-primary" />
				) : (
					<Logo markClassName="text-primary" />
				)}
				{onToggleCollapsed && (
					<button
						type="button"
						onClick={onToggleCollapsed}
						aria-label={collapsed ? t("nav.expand") : t("nav.collapse")}
						aria-pressed={collapsed}
						title={collapsed ? t("nav.expand") : t("nav.collapse")}
						className="rounded p-1 text-sidebar-muted transition-colors hover:bg-sidebar-hover hover:text-white"
					>
						{collapsed ? (
							<PanelLeftOpen aria-hidden className="size-4" />
						) : (
							<PanelLeftClose aria-hidden className="size-4" />
						)}
					</button>
				)}
			</div>
			<div className="space-y-2">
				<OrgSwitcher collapsed={collapsed} />
				<ProjectSwitcher collapsed={collapsed} />
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
								collapsed={collapsed}
								icon={LayoutDashboard}
								to="/$orgSlug/projects/$projectSlug/overview"
								params={{
									orgSlug: organization.slug,
									projectSlug: project.slug,
								}}
							>
								{t("nav.overview")}
							</SidebarLink>
							<SidebarLink
								collapsed={collapsed}
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
								collapsed={collapsed}
								icon={Gauge}
								to="/$orgSlug/projects/$projectSlug/performance"
								params={{
									orgSlug: organization.slug,
									projectSlug: project.slug,
								}}
								activeOptions={{ exact: false }}
							>
								{t("nav.performance")}
							</SidebarLink>
							<SidebarLink
								collapsed={collapsed}
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
								collapsed={collapsed}
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
								collapsed={collapsed}
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
						collapsed={collapsed}
						icon={FolderKanban}
						to="/$orgSlug/projects"
						params={{ orgSlug: organization.slug }}
						// Los proyectos individuales cuelgan de /projects: sin `exact` se resaltaría siempre.
						activeOptions={{ exact: true }}
					>
						{t("nav.projects")}
					</SidebarLink>
					<SidebarLink
						collapsed={collapsed}
						icon={Users}
						to="/$orgSlug/members"
						params={{ orgSlug: organization.slug }}
					>
						{t("nav.members")}
					</SidebarLink>
					<SidebarLink
						collapsed={collapsed}
						icon={KeyRound}
						to="/$orgSlug/tokens"
						params={{ orgSlug: organization.slug }}
					>
						{t("nav.tokens")}
					</SidebarLink>
				</nav>
			)}
			<div className="mt-auto border-t border-white/10 pt-3">
				<UserMenu onStartTour={restart} collapsed={collapsed} />
			</div>
		</div>
	);
}
