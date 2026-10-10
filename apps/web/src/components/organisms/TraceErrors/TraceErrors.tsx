import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/atoms/Card/Card";
import { LevelBadge } from "@/components/molecules/LevelBadge/LevelBadge";
import { RelativeTime } from "@/components/molecules/RelativeTime/RelativeTime";
import type { TraceErrorsProps } from "@/components/organisms/TraceErrors/TraceErrorsInterface";
import { useCurrentProject } from "@/hooks/useScope/useScope";

/** Los errores que ocurrieron durante la traza; cada uno abre ese evento concreto de su issue. */
export function TraceErrors({ events }: TraceErrorsProps) {
	const { t } = useTranslation();
	const { organization, project } = useCurrentProject();
	if (!organization || !project) return null;
	return (
		<Card className="p-4" data-testid="trace-errors">
			<h2 className="mb-3 text-sm font-semibold text-foreground">
				{t("performance.trace.errors")}
			</h2>
			{events.length === 0 ? (
				<p className="text-sm text-muted">{t("performance.trace.noErrors")}</p>
			) : (
				<ul className="divide-y divide-border">
					{events.map((e) => (
						<li
							key={e.id}
							className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2"
							data-testid="trace-error"
						>
							<LevelBadge level={e.level} />
							<Link
								to="/$orgSlug/projects/$projectSlug/issues/$issueId"
								params={{
									orgSlug: organization.slug,
									projectSlug: project.slug,
									issueId: e.issueId,
								}}
								search={{ event: e.id }}
								className="min-w-0 flex-1 truncate text-sm font-medium text-foreground hover:text-primary hover:underline"
							>
								{e.issueTitle}
							</Link>
							<RelativeTime date={e.timestamp} className="text-xs text-muted" />
						</li>
					))}
				</ul>
			)}
		</Card>
	);
}
