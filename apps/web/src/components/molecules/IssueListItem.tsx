import type { IssueDto } from "@sentinel/shared";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/atoms/Badge";
import { cn } from "@/utils/cn/cn";
import { formatCompact, formatRelative } from "@/utils/time/time";
import { LevelBadge } from "./LevelBadge";
import { RelativeTime } from "./RelativeTime";
import { StatusBadge } from "./StatusBadge";

const LEVEL_BAR: Record<string, string> = {
	fatal: "bg-fatal",
	error: "bg-error",
	warning: "bg-warning",
	info: "bg-info",
	debug: "bg-debug",
};

/** Columnas compartidas con la cabecera de la lista. */
export const ISSUE_GRID =
	"grid grid-cols-[minmax(0,1fr)_4.5rem_4.5rem_7rem] items-center gap-4";

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
