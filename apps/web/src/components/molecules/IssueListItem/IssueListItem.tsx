import type { IssueDto } from "@sentinel/shared";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Avatar } from "@/components/atoms/Avatar/Avatar";
import { Badge } from "@/components/atoms/Badge/Badge";
import { Sparkline } from "@/components/atoms/Sparkline/Sparkline";
import {
	ISSUE_GRID,
	LEVEL_BAR,
} from "@/components/molecules/IssueListItem/IssueListItem.constants";
import { LevelBadge } from "@/components/molecules/LevelBadge/LevelBadge";
import { RelativeTime } from "@/components/molecules/RelativeTime/RelativeTime";
import { StatusBadge } from "@/components/molecules/StatusBadge/StatusBadge";
import { staggerStyle } from "@/utils/animation/animation";
import { cn } from "@/utils/cn/cn";
import { formatCompact, formatRelative } from "@/utils/time/time";

export function IssueListItem({
	issue,
	orgSlug,
	projectSlug,
	index = 0,
	trend,
}: {
	issue: IssueDto;
	orgSlug: string;
	projectSlug: string;
	/** Posición en la lista: escalona la entrada de las filas. */
	index?: number;
	/** Eventos por hora de las últimas 24 h. */
	trend?: number[];
}) {
	const { t, i18n } = useTranslation();
	return (
		<li className="animate-fade-in-up" style={staggerStyle(index)}>
			<Link
				to="/$orgSlug/projects/$projectSlug/issues/$issueId"
				params={{ orgSlug, projectSlug, issueId: issue.id }}
				className={cn(
					ISSUE_GRID,
					"relative flex flex-col gap-2 border-b border-border py-3 pr-4 pl-5 transition-colors last:border-b-0 hover:bg-primary-soft/40 md:px-5",
				)}
				data-testid="issue-row"
			>
				<span
					aria-hidden
					className={cn(
						"absolute inset-y-0 left-0 w-1",
						LEVEL_BAR[issue.level] ?? "bg-debug",
					)}
				/>
				<span className="min-w-0">
					<span className="flex flex-wrap items-center gap-x-2 gap-y-1 md:flex-nowrap">
						<span className="line-clamp-2 min-w-0 text-sm font-semibold break-words text-foreground md:line-clamp-none md:truncate">
							{issue.title}
						</span>
						{issue.status !== "unresolved" && (
							<StatusBadge status={issue.status} />
						)}
						{issue.status === "unresolved" && issue.regressedAt && (
							<Badge tone="warning">{t("issues.regression")}</Badge>
						)}
					</span>
					<span className="mt-1 flex items-center gap-2 text-xs text-muted md:mt-0.5">
						<LevelBadge level={issue.level} />
						{issue.assignee && (
							<span
								className="inline-flex shrink-0 items-center gap-1 text-faint"
								title={t("issues.assignedTo", { name: issue.assignee.name })}
							>
								<Avatar
									name={issue.assignee.name}
									rounded="full"
									className="size-4 text-[8px]"
								/>
								<span className="sr-only">
									{t("issues.assignedTo", { name: issue.assignee.name })}
								</span>
							</span>
						)}
						{issue.culprit && (
							<span className="min-w-0 truncate font-mono">
								{issue.culprit}
							</span>
						)}
						<span className="hidden shrink-0 text-faint sm:inline">
							·{" "}
							{t("issues.firstSeen", {
								when: formatRelative(issue.firstSeen, i18n.language),
							})}
						</span>
					</span>
				</span>
				{/* En pantallas estrechas las cifras van en una fila con su etiqueta; desde `md` se reparten por columnas. */}
				<span className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted md:contents">
					<span className="order-last ml-auto md:order-none md:ml-0 md:justify-self-end">
						{trend && (
							<Sparkline values={trend} label={t("issues.trendLabel")} />
						)}
					</span>
					<span className="tabular-nums md:text-right md:text-sm md:text-foreground">
						<span className="text-faint md:hidden">
							{t("issues.columns.events")}{" "}
						</span>
						<span className="font-medium text-foreground md:font-normal">
							{formatCompact(issue.eventCount, i18n.language)}
						</span>
					</span>
					<span className="tabular-nums md:text-right md:text-sm md:text-foreground">
						<span className="text-faint md:hidden">
							{t("issues.columns.users")}{" "}
						</span>
						<span className="font-medium text-foreground md:font-normal">
							{formatCompact(issue.userCount, i18n.language)}
						</span>
					</span>
					<RelativeTime
						date={issue.lastSeen}
						className="text-xs text-muted md:text-right"
					/>
				</span>
			</Link>
		</li>
	);
}
