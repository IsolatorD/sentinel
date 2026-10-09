import type { IssueDto } from "@sentinel/shared";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Avatar } from "@/components/atoms/Avatar/Avatar";
import { Badge } from "@/components/atoms/Badge/Badge";
import {
	ISSUE_GRID,
	LEVEL_BAR,
} from "@/components/molecules/IssueListItem/IssueListItem.constants";
import { LevelBadge } from "@/components/molecules/LevelBadge/LevelBadge";
import { RelativeTime } from "@/components/molecules/RelativeTime/RelativeTime";
import { StatusBadge } from "@/components/molecules/StatusBadge/StatusBadge";
import { cn } from "@/utils/cn/cn";
import { formatCompact, formatRelative } from "@/utils/time/time";

export function IssueListItem({
	issue,
	orgSlug,
	projectSlug,
}: {
	issue: IssueDto;
	orgSlug: string;
	projectSlug: string;
}) {
	const { t, i18n } = useTranslation();
	return (
		<li>
			<Link
				to="/$orgSlug/projects/$projectSlug/issues/$issueId"
				params={{ orgSlug, projectSlug, issueId: issue.id }}
				className={cn(
					ISSUE_GRID,
					"relative border-b border-border px-5 py-3 transition-colors last:border-b-0 hover:bg-primary-soft/40",
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
					<span className="flex items-center gap-2">
						<span className="truncate text-sm font-semibold text-foreground">
							{issue.title}
						</span>
						{issue.status !== "unresolved" && (
							<StatusBadge status={issue.status} />
						)}
						{issue.status === "unresolved" && issue.regressedAt && (
							<Badge tone="warning">{t("issues.regression")}</Badge>
						)}
					</span>
					<span className="mt-0.5 flex items-center gap-2 text-xs text-muted">
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
							<span className="truncate font-mono">{issue.culprit}</span>
						)}
						<span className="hidden shrink-0 text-faint sm:inline">
							·{" "}
							{t("issues.firstSeen", {
								when: formatRelative(issue.firstSeen, i18n.language),
							})}
						</span>
					</span>
				</span>
				<span className="text-right text-sm tabular-nums text-foreground">
					{formatCompact(issue.eventCount, i18n.language)}
				</span>
				<span className="text-right text-sm tabular-nums text-foreground">
					{formatCompact(issue.userCount, i18n.language)}
				</span>
				<RelativeTime
					date={issue.lastSeen}
					className="text-right text-xs text-muted"
				/>
			</Link>
		</li>
	);
}
