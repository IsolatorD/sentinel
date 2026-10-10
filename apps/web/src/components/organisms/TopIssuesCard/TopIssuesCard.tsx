import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/atoms/Card/Card";
import { LevelBadge } from "@/components/molecules/LevelBadge/LevelBadge";
import { StatusBadge } from "@/components/molecules/StatusBadge/StatusBadge";
import type { TopIssuesCardProps } from "@/components/organisms/TopIssuesCard/TopIssuesCardInterface";
import { useCurrentProject } from "@/hooks/useScope/useScope";
import { formatCompact } from "@/utils/time/time";

/** Los issues que más eventos generaron en el periodo. */
export function TopIssuesCard({ issues }: TopIssuesCardProps) {
	const { t, i18n } = useTranslation();
	const { organization, project } = useCurrentProject();
	return (
		<Card className="p-4" data-testid="top-issues">
			<h3 className="text-sm font-semibold text-foreground">
				{t("overview.topIssues")}
			</h3>
			{issues.length === 0 || !organization || !project ? (
				<p className="mt-3 text-sm text-muted">{t("overview.noData")}</p>
			) : (
				<ul className="mt-3 divide-y divide-border">
					{issues.map((issue) => (
						<li
							key={issue.id}
							className="flex items-center gap-3 py-2"
							data-testid="top-issue"
						>
							<LevelBadge level={issue.level} />
							<Link
								to="/$orgSlug/projects/$projectSlug/issues/$issueId"
								params={{
									orgSlug: organization.slug,
									projectSlug: project.slug,
									issueId: issue.id,
								}}
								className="min-w-0 flex-1 truncate text-sm font-medium text-foreground hover:text-primary hover:underline"
								title={issue.title}
							>
								{issue.title}
							</Link>
							{issue.status !== "unresolved" && (
								<StatusBadge status={issue.status} />
							)}
							<span className="w-12 shrink-0 text-right text-sm tabular-nums">
								{formatCompact(issue.events, i18n.language)}
							</span>
						</li>
					))}
				</ul>
			)}
		</Card>
	);
}
