import { useNavigate } from "@tanstack/react-router";
import { ChevronsUpDown, FolderKanban } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Menu } from "@/components/molecules/Menu/Menu";
import { MenuContent } from "@/components/molecules/MenuContent/MenuContent";
import { MenuItem } from "@/components/molecules/MenuItem/MenuItem";
import { MenuLabel } from "@/components/molecules/MenuLabel/MenuLabel";
import { MenuSeparator } from "@/components/molecules/MenuSeparator/MenuSeparator";
import { MenuTrigger } from "@/components/molecules/MenuTrigger/MenuTrigger";
import { useCurrentProject } from "@/hooks/useScope/useScope";
import { cn } from "@/utils/cn/cn";

export function ProjectSwitcher({
	collapsed = false,
}: {
	collapsed?: boolean;
}) {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const { organization, project, projects } = useCurrentProject();
	if (!organization) return null;

	return (
		<Menu>
			<MenuTrigger
				data-tour="project-switcher"
				className={cn(
					"flex w-full items-center gap-2 rounded-md border border-white/10 px-2.5 py-1.5 text-left text-sm text-sidebar-text hover:bg-sidebar-hover",
					collapsed && "justify-center px-0",
				)}
				aria-label={t("nav.project")}
				title={collapsed ? (project?.name ?? t("nav.allProjects")) : undefined}
			>
				<FolderKanban
					aria-hidden
					className="size-4 shrink-0 text-sidebar-muted"
				/>
				{!collapsed && (
					<>
						<span className="min-w-0 flex-1 truncate">
							{project?.name ?? t("nav.allProjects")}
						</span>
						<ChevronsUpDown
							aria-hidden
							className="size-4 shrink-0 text-sidebar-muted"
						/>
					</>
				)}
			</MenuTrigger>
			<MenuContent
				align="start"
				side={collapsed ? "right" : "bottom"}
				className="w-64"
			>
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
