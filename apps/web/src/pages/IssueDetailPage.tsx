import { Link, useParams } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/atoms/Skeleton/Skeleton";
import { ErrorState } from "@/components/molecules/ErrorState/ErrorState";
import { EventNavigator } from "@/components/organisms/EventNavigator/EventNavigator";
import { IssueEventDetails } from "@/components/organisms/IssueEventDetails/IssueEventDetails";
import { IssueEventsTable } from "@/components/organisms/IssueEventsTable/IssueEventsTable";
import { IssueHeader } from "@/components/organisms/IssueHeader/IssueHeader";
import { PageTemplate } from "@/components/templates/PageTemplate";
import {
	useIssue,
	useIssueEvent,
	useIssueEvents,
} from "@/hooks/useIssues/useIssues";
import { useCurrentProject } from "@/hooks/useScope/useScope";
import { useIssueSearch } from "@/hooks/useSearchParams/useSearchParams";
import { ApiError } from "@/utils/apiError/apiError";
import { cn } from "@/utils/cn/cn";
import { NotFoundPage } from "./NotFoundPage";
import { ProjectGate } from "./ProjectGate";

function Content() {
	const { t } = useTranslation();
	const { issueId } = useParams({ strict: false }) as { issueId: string };
	const { organization, project, scope } = useCurrentProject();
	const { search, update } = useIssueSearch();

	const issue = useIssue(scope, issueId);
	const recent = useIssueEvents(scope, issueId, { limit: 50, offset: 0 });
	const picked = useIssueEvent(scope, issueId, search.event);

	if (!organization || !project) return null;
	if (issue.isError) {
		return issue.error instanceof ApiError && issue.error.status === 404 ? (
			<NotFoundPage />
		) : (
			<ErrorState
				title={t("issue.loadError")}
				onRetry={() => issue.refetch()}
			/>
		);
	}
	const ready = { orgId: organization.id, projectId: project.id };
	const event = search.event ? picked.data : issue.data?.latestEvent;

	return (
		<PageTemplate
			eyebrow={
				<Link
					to="/$orgSlug/projects/$projectSlug/issues"
					params={{ orgSlug: organization.slug, projectSlug: project.slug }}
					className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
				>
					<ArrowLeft aria-hidden className="size-4" />
					{t("issue.back")}
				</Link>
			}
		>
			{!issue.data ? (
				<Skeleton className="h-40 w-full" />
			) : (
				<div className="space-y-4">
					<IssueHeader
						issue={issue.data}
						scope={ready}
						orgSlug={organization.slug}
						projectSlug={project.slug}
					/>

					<div role="tablist" className="flex gap-5 border-b border-border">
						{(["details", "events"] as const).map((tab) => (
							<button
								key={tab}
								type="button"
								role="tab"
								aria-selected={search.tab === tab}
								onClick={() => update({ tab })}
								className={cn(
									"-mb-px border-b-2 px-0.5 pb-2 text-sm font-medium",
									search.tab === tab
										? "border-primary text-foreground"
										: "border-transparent text-muted hover:text-foreground",
								)}
							>
								{t(`issue.tabs.${tab}`)}
							</button>
						))}
					</div>

					{search.tab === "events" ? (
						<IssueEventsTable
							scope={ready}
							issueId={issueId}
							onView={(id) => update({ event: id, tab: "details" })}
						/>
					) : event ? (
						<div className="space-y-4">
							<EventNavigator
								event={event}
								events={recent.data?.items ?? []}
								onSelect={(id) => update({ event: id })}
							/>
							<IssueEventDetails event={event} />
						</div>
					) : picked.isError ? (
						<ErrorState onRetry={() => picked.refetch()} />
					) : (
						<Skeleton className="h-64 w-full" />
					)}
				</div>
			)}
		</PageTemplate>
	);
}

export function IssueDetailPage() {
	return (
		<ProjectGate>
			<Content />
		</ProjectGate>
	);
}
