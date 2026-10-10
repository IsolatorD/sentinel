import { Link } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, Gauge, SearchX } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/atoms/Button/Button";
import { Card } from "@/components/atoms/Card/Card";
import { Skeleton } from "@/components/atoms/Skeleton/Skeleton";
import { EmptyState } from "@/components/molecules/EmptyState/EmptyState";
import { ErrorState } from "@/components/molecules/ErrorState/ErrorState";
import { Pagination } from "@/components/molecules/Pagination/Pagination";
import { RelativeTime } from "@/components/molecules/RelativeTime/RelativeTime";
import { SORTABLE } from "@/components/organisms/TransactionsTable/TransactionsTable.constants";
import { useTransactions } from "@/hooks/usePerformance/usePerformance";
import { useCurrentProject } from "@/hooks/useScope/useScope";
import { usePerformanceSearch } from "@/hooks/useSearchParams/useSearchParams";
import { staggerStyle } from "@/utils/animation/animation";
import { cn } from "@/utils/cn/cn";
import {
	formatMs,
	formatPercent,
	formatPerMinute,
} from "@/utils/performance/performance";
import { PAGE_SIZE } from "@/utils/searchParams/searchParams.constants";
import { formatCompact } from "@/utils/time/time";

export function TransactionsTable() {
	const { t, i18n } = useTranslation();
	const { organization, project, scope } = useCurrentProject();
	const { search, update } = usePerformanceSearch();
	const locale = i18n.language;
	const list = useTransactions(scope, {
		period: search.period,
		environment: search.environment,
		release: search.release,
		q: search.q,
		sort: search.sort,
		order: search.order,
		limit: PAGE_SIZE,
		offset: (search.page - 1) * PAGE_SIZE,
	});
	const data = list.data;
	const hasFilters = Boolean(search.q || search.environment || search.release);

	function sortBy(sort: (typeof SORTABLE)[number]["sort"]) {
		update(
			{
				sort,
				order: search.sort === sort && search.order === "desc" ? "asc" : "desc",
			},
			{ resetPage: true },
		);
	}

	if (!organization || !project) return null;
	if (list.isError)
		return (
			<ErrorState
				title={t("performance.table.loadError")}
				onRetry={() => list.refetch()}
			/>
		);

	return (
		<div className="space-y-3">
			<Card className="overflow-x-auto" data-tour="transactions-table">
				{data && data.total === 0 ? (
					hasFilters ? (
						<EmptyState
							icon={SearchX}
							title={t("performance.table.emptyFiltered.title")}
							description={t("performance.table.emptyFiltered.description")}
							action={
								<Button
									onClick={() =>
										update(
											{
												q: undefined,
												environment: undefined,
												release: undefined,
											},
											{ resetPage: true },
										)
									}
								>
									{t("issues.emptyFiltered.clear")}
								</Button>
							}
						/>
					) : (
						<EmptyState
							icon={Gauge}
							title={t("performance.table.empty.title")}
							description={t("performance.table.empty.description")}
						/>
					)
				) : (
					<table
						className={cn(
							"w-full text-left text-sm",
							list.isPlaceholderData && "opacity-60 transition-opacity",
						)}
						data-testid="transactions-table"
					>
						<thead>
							<tr className="border-b border-border bg-subtle/70 text-[11px] tracking-wide text-faint uppercase">
								<th className="px-5 py-2 font-medium">
									{t("performance.table.columns.name")}
								</th>
								{SORTABLE.map(({ sort }) => (
									<th
										key={sort}
										className="px-3 py-2 text-right font-medium"
										aria-sort={
											search.sort === sort
												? search.order === "desc"
													? "descending"
													: "ascending"
												: "none"
										}
									>
										<button
											type="button"
											onClick={() => sortBy(sort)}
											className="inline-flex items-center gap-1 uppercase hover:text-foreground"
										>
											{t(`performance.table.columns.${sort}`)}
											{search.sort === sort &&
												(search.order === "desc" ? (
													<ArrowDown aria-hidden className="size-3" />
												) : (
													<ArrowUp aria-hidden className="size-3" />
												))}
										</button>
									</th>
								))}
							</tr>
						</thead>
						<tbody>
							{!data
								? [0, 1, 2].map((i) => (
										<tr key={i} className="border-b border-border">
											<td colSpan={SORTABLE.length + 1} className="px-5 py-3">
												<Skeleton className="h-4 w-full" />
											</td>
										</tr>
									))
								: data.items.map((g, index) => (
										<tr
											key={`${g.name}|${g.op}`}
											className="animate-fade-in border-b border-border last:border-b-0 hover:bg-primary-soft/40"
											style={staggerStyle(index)}
											data-testid="transaction-row"
										>
											<td className="max-w-80 px-5 py-2.5">
												<Link
													to="/$orgSlug/projects/$projectSlug/performance/transaction"
													params={{
														orgSlug: organization.slug,
														projectSlug: project.slug,
													}}
													search={{
														name: g.name,
														period:
															search.period === "24h"
																? undefined
																: search.period,
														environment: search.environment,
														release: search.release,
													}}
													className="block truncate font-medium text-foreground hover:text-primary hover:underline"
													title={g.name}
												>
													{g.name}
												</Link>
												<span className="font-mono text-xs text-faint">
													{g.op}
												</span>
											</td>
											<td className="px-3 py-2.5 text-right tabular-nums">
												{formatCompact(g.count, locale)}
											</td>
											<td className="px-3 py-2.5 text-right tabular-nums">
												{formatMs(g.p50, locale)}
											</td>
											<td className="px-3 py-2.5 text-right tabular-nums">
												{formatMs(g.p95, locale)}
											</td>
											<td
												className={cn(
													"px-3 py-2.5 text-right tabular-nums",
													g.errorRate > 0 && "text-danger",
												)}
											>
												{formatPercent(g.errorRate, locale)}
											</td>
											<td className="px-3 py-2.5 text-right tabular-nums">
												{formatPerMinute(g.tpm, locale)}
											</td>
											<td className="px-3 py-2.5 text-right whitespace-nowrap">
												<RelativeTime
													date={g.lastSeen}
													className="text-xs text-muted"
												/>
											</td>
										</tr>
									))}
						</tbody>
					</table>
				)}
			</Card>
			{data && data.total > 0 && (
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
