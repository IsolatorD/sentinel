import { Link } from "@tanstack/react-router";
import { Inbox, SearchX } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button, buttonVariants } from "@/components/atoms/Button";
import { Card } from "@/components/atoms/Card";
import { Skeleton } from "@/components/atoms/Skeleton";
import { EmptyState } from "@/components/molecules/EmptyState";
import { ErrorState } from "@/components/molecules/ErrorState";
import {
	ISSUE_GRID,
	IssueListItem,
} from "@/components/molecules/IssueListItem";
import { Pagination } from "@/components/molecules/Pagination";
import { useIssues } from "@/hooks/use-issues";
import { useCurrentProject } from "@/hooks/use-scope";
import { useIssuesSearch } from "@/hooks/use-search-params";
import { cn } from "@/utils/cn/cn";
import { PAGE_SIZE } from "@/utils/searchParams/searchParams.constants";

function ListSkeleton() {
	return (
		<ul aria-busy="true" data-testid="issue-list-loading">
			{[0, 1, 2, 3, 4].map((i) => (
				<li
					key={i}
					className={cn(
						ISSUE_GRID,
						"border-b border-border px-5 py-3.5 last:border-b-0",
					)}
				>
					<span className="space-y-2">
						<Skeleton className="h-4 w-3/5" />
						<Skeleton className="h-3 w-2/5" />
					</span>
					<Skeleton className="ml-auto h-4 w-8" />
					<Skeleton className="ml-auto h-4 w-8" />
					<Skeleton className="ml-auto h-4 w-16" />
				</li>
			))}
		</ul>
	);
}

export function IssueList() {
	const { t } = useTranslation();
	const { organization, project, scope } = useCurrentProject();
	const { search, update } = useIssuesSearch();
	const offset = (search.page - 1) * PAGE_SIZE;
	const issues = useIssues(scope, {
		status: search.status,
		level: search.level,
		q: search.q,
		environment: search.environment,
		release: search.release,
		sort: search.sort,
		order: search.order,
		limit: PAGE_SIZE,
		offset,
	});

	const hasFilters =
		search.status !== "unresolved" ||
		Boolean(search.q) ||
		Boolean(search.level) ||
		Boolean(search.environment) ||
		Boolean(search.release);
	const clearFilters = () =>
		update(
			{
				status: "unresolved",
				q: undefined,
				level: undefined,
				environment: undefined,
				release: undefined,
			},
			{ resetPage: true },
		);
	const data = issues.data;

	return (
		<div className="space-y-3">
			<Card className="overflow-hidden">
				<div
					className={cn(
						ISSUE_GRID,
						"border-b border-border bg-subtle/70 px-5 py-2 text-[11px] font-medium tracking-wide text-faint uppercase",
					)}
				>
					<span>{t("issues.columns.issue")}</span>
					<span className="text-right">{t("issues.columns.events")}</span>
					<span className="text-right">{t("issues.columns.users")}</span>
					<span className="text-right">{t("issues.columns.lastSeen")}</span>
				</div>

				{issues.isError ? (
					<ErrorState
						title={t("issues.loadError")}
						onRetry={() => issues.refetch()}
					/>
				) : !data ? (
					<ListSkeleton />
				) : data.total === 0 ? (
					hasFilters ? (
						<EmptyState
							icon={SearchX}
							title={t("issues.emptyFiltered.title")}
							description={t("issues.emptyFiltered.description")}
							action={
								<Button onClick={clearFilters}>
									{t("issues.emptyFiltered.clear")}
								</Button>
							}
						/>
					) : (
						<EmptyState
							icon={Inbox}
							title={t("issues.empty.title")}
							description={t("issues.empty.description")}
							action={
								organization &&
								project && (
									<Link
										to="/$orgSlug/projects/$projectSlug/settings"
										params={{
											orgSlug: organization.slug,
											projectSlug: project.slug,
										}}
										className={buttonVariants({ variant: "primary" })}
									>
										{t("issues.empty.installHint")}
									</Link>
								)
							}
						/>
					)
				) : (
					<ul
						className={cn(
							issues.isPlaceholderData && "opacity-60 transition-opacity",
						)}
						data-testid="issue-list"
					>
						{organization &&
							project &&
							data.items.map((issue) => (
								<IssueListItem
									key={issue.id}
									issue={issue}
									orgSlug={organization.slug}
									projectSlug={project.slug}
								/>
							))}
					</ul>
				)}
			</Card>
			{data && (
				<Pagination
					offset={data.offset}
					limit={data.limit}
					total={data.total}
					onChange={(next) =>
						update({ page: Math.floor(next / PAGE_SIZE) + 1 })
					}
				/>
			)}
		</div>
	);
}
