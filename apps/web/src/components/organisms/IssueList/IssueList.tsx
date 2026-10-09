import { Link } from "@tanstack/react-router";
import { Inbox, SearchX } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/atoms/Button/Button";
import { buttonVariants } from "@/components/atoms/Button/Button.constants";
import { Card } from "@/components/atoms/Card/Card";
import { EmptyState } from "@/components/molecules/EmptyState/EmptyState";
import { ErrorState } from "@/components/molecules/ErrorState/ErrorState";
import { IssueListItem } from "@/components/molecules/IssueListItem/IssueListItem";
import { ISSUE_GRID } from "@/components/molecules/IssueListItem/IssueListItem.constants";
import { Pagination } from "@/components/molecules/Pagination/Pagination";
import { ListSkeleton } from "@/components/organisms/IssueList/ListSkeleton/ListSkeleton";
import { useIssues } from "@/hooks/useIssues/useIssues";
import { useCurrentProject } from "@/hooks/useScope/useScope";
import { useIssuesSearch } from "@/hooks/useSearchParams/useSearchParams";
import { cn } from "@/utils/cn/cn";
import { PAGE_SIZE } from "@/utils/searchParams/searchParams.constants";

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
