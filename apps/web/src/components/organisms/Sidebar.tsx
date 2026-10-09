import { useNavigate } from "@tanstack/react-router";
import {
	Bug,
	ChevronsUpDown,
	FolderKanban,
	LogOut,
	Plus,
	Settings,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Avatar } from "@/components/atoms/Avatar";
import { Logo } from "@/components/atoms/Logo";
import { LanguageSelect } from "@/components/molecules/LanguageSelect";
import {
	Menu,
	MenuContent,
	MenuItem,
	MenuLabel,
	MenuSeparator,
	MenuTrigger,
} from "@/components/molecules/Menu";
import { SidebarLink } from "@/components/molecules/SidebarLink";
import { useCurrentOrganization, useCurrentProject } from "@/hooks/use-scope";
import { useSession, useSignOut } from "@/hooks/use-session";
import { LAST_ORG_KEY, writeStorage } from "@/lib/storage";

function OrgSwitcher() {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const { organization, organizations } = useCurrentOrganization();
	if (!organization) return null;

	return (
		<Menu>
			<MenuTrigger
				className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left hover:bg-sidebar-hover focus-visible:outline-primary"
				aria-label={t("nav.switchOrganization")}
			>
				<Avatar name={organization.name} />
				<span className="min-w-0 flex-1 truncate text-sm font-medium text-white">
					{organization.name}
				</span>
				<ChevronsUpDown
					aria-hidden
					className="size-4 shrink-0 text-sidebar-muted"
				/>
			</MenuTrigger>
			<MenuContent align="start" className="w-64">
				<MenuLabel>{t("nav.switchOrganization")}</MenuLabel>
				{organizations.map((org) => (
					<MenuItem
						key={org.id}
						onSelect={() => {
							writeStorage(LAST_ORG_KEY, org.slug);
							navigate({ to: "/$orgSlug", params: { orgSlug: org.slug } });
						}}
					>
						<Avatar name={org.name} className="size-5 text-[9px]" />
						<span className="truncate">{org.name}</span>
					</MenuItem>
				))}
				<MenuSeparator />
				<MenuItem onSelect={() => navigate({ to: "/onboarding" })}>
					<Plus aria-hidden className="size-4" />
					{t("nav.createOrganization")}
				</MenuItem>
			</MenuContent>
		</Menu>
	);
}

function ProjectSwitcher() {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const { organization, project, projects } = useCurrentProject();
	if (!organization) return null;

	return (
		<Menu>
			<MenuTrigger
				className="flex w-full items-center gap-2 rounded-md border border-white/10 px-2.5 py-1.5 text-left text-sm text-sidebar-text hover:bg-sidebar-hover"
				aria-label={t("nav.project")}
			>
				<FolderKanban
					aria-hidden
					className="size-4 shrink-0 text-sidebar-muted"
				/>
				<span className="min-w-0 flex-1 truncate">
					{project?.name ?? t("nav.allProjects")}
				</span>
				<ChevronsUpDown
					aria-hidden
					className="size-4 shrink-0 text-sidebar-muted"
				/>
			</MenuTrigger>
			<MenuContent align="start" className="w-64">
				<MenuLabel>{t("nav.project")}</MenuLabel>
				{projects.map((p) => (
					<MenuItem
						key={p.id}
						onSelect={() =>
							navigate({
								to: "/$orgSlug/projects/$projectSlug/issues",
								params: { orgSlug: organization.slug, projectSlug: p.slug },
							})
						}
					>
						<span className="truncate">{p.name}</span>
					</MenuItem>
				))}
				<MenuSeparator />
				<MenuItem
					onSelect={() =>
						navigate({
							to: "/$orgSlug/projects",
							params: { orgSlug: organization.slug },
						})
					}
				>
					{t("nav.allProjects")}
				</MenuItem>
			</MenuContent>
		</Menu>
	);
}

function UserMenu() {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const session = useSession();
	const signOut = useSignOut();
	const user = session.data?.user;
	if (!user) return null;

	return (
		<Menu>
			<MenuTrigger
				className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left hover:bg-sidebar-hover"
				aria-label={t("nav.account")}
			>
				<Avatar name={user.name} rounded="full" />
				<span className="min-w-0 flex-1">
					<span className="block truncate text-sm font-medium text-white">
						{user.name}
					</span>
					<span className="block truncate text-xs text-sidebar-muted">
						{user.email}
					</span>
				</span>
			</MenuTrigger>
			<MenuContent align="start" side="top" className="w-64">
				<MenuLabel>{t("common.language")}</MenuLabel>
				<div className="px-2 pb-1">
					<LanguageSelect />
				</div>
				<MenuSeparator />
				<MenuItem
					onSelect={() =>
						signOut.mutate(undefined, {
							onSuccess: () => navigate({ to: "/login" }),
						})
					}
				>
					<LogOut aria-hidden className="size-4" />
					{t("nav.signOut")}
				</MenuItem>
			</MenuContent>
		</Menu>
	);
}

export function Sidebar() {
	const { t } = useTranslation();
	const { organization, project } = useCurrentProject();

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
				<nav aria-label={t("nav.main")} className="flex flex-col gap-0.5">
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
				</nav>
			)}
			<div className="mt-auto border-t border-white/10 pt-3">
				<UserMenu />
			</div>
		</div>
	);
}
