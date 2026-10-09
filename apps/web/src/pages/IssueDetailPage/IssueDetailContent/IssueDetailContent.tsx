import { Link, useParams } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/atoms/Skeleton/Skeleton";
import { ErrorState } from "@/components/molecules/ErrorState/ErrorState";
import { TabBar } from "@/components/molecules/TabBar/TabBar";
import { EventNavigator } from "@/components/organisms/EventNavigator/EventNavigator";
import { IssueActivity } from "@/components/organisms/IssueActivity/IssueActivity";
import { IssueEventDetails } from "@/components/organisms/IssueEventDetails/IssueEventDetails";
import { IssueEventsTable } from "@/components/organisms/IssueEventsTable/IssueEventsTable";
import { IssueHeader } from "@/components/organisms/IssueHeader/IssueHeader";
import { PageTemplate } from "@/components/templates/PageTemplate/PageTemplate";
import {
	useIssue,
	useIssueEvent,
	useIssueEvents,
} from "@/hooks/useIssues/useIssues";
import { useCurrentProject } from "@/hooks/useScope/useScope";
import { useIssueSearch } from "@/hooks/useSearchParams/useSearchParams";
import { useSession } from "@/hooks/useSession/useSession";
import { NotFoundPage } from "@/pages/NotFoundPage/NotFoundPage";
import { ApiError } from "@/utils/apiError/apiError";

export function IssueDetailContent() {
	const { t } = useTranslation();
	const { issueId } = useParams({ strict: false }) as { issueId: string };
	const { organization, project, scope } = useCurrentProject();
	const { search, update } = useIssueSearch();
	const session = useSession();

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

					<TabBar
						label={t("issue.tabs.label")}
						active={search.tab}
						onChange={(tab) => update({ tab: tab as typeof search.tab })}
						tabs={(["details", "events", "activity"] as const).map((id) => ({
							id,
							label: t(`issue.tabs.${id}`),
						}))}
					/>

					<div key={search.tab} className="animate-fade-in">
						{search.tab === "activity" ? (
							<IssueActivity
								scope={ready}
								issueId={issueId}
								currentUserId={session.data?.user.id ?? ""}
							/>
						) : search.tab === "events" ? (
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
				</div>
			)}
		</PageTemplate>
	);
}
