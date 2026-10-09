import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/atoms/Card/Card";
import { Skeleton } from "@/components/atoms/Skeleton/Skeleton";
import { ErrorState } from "@/components/molecules/ErrorState/ErrorState";
import { Pagination } from "@/components/molecules/Pagination/Pagination";
import { RelativeTime } from "@/components/molecules/RelativeTime/RelativeTime";
import { useIssueEvents } from "@/hooks/useIssues/useIssues";
import type { ReadyScope } from "@/hooks/useIssues/useIssuesInterface";

const PAGE = 20;

export function IssueEventsTable({
	scope,
	issueId,
	onView,
}: {
	scope: ReadyScope;
	issueId: string;
	onView: (eventId: string) => void;
}) {
	const { t } = useTranslation();
	const [offset, setOffset] = useState(0);
	const events = useIssueEvents(scope, issueId, { limit: PAGE, offset });

	if (events.isError) return <ErrorState onRetry={() => events.refetch()} />;
	const data = events.data;

	return (
		<div className="space-y-3">
			<Card className="overflow-x-auto">
				<table className="w-full text-left text-sm" data-testid="events-table">
					<thead>
						<tr className="border-b border-border bg-subtle/70 text-[11px] tracking-wide text-faint uppercase">
							<th className="px-5 py-2 font-medium">
								{t("issue.events.time")}
							</th>
							<th className="px-3 py-2 font-medium">
								{t("issue.events.message")}
							</th>
							<th className="px-3 py-2 font-medium">
								{t("issue.events.release")}
							</th>
							<th className="px-3 py-2 font-medium">
								{t("issue.events.user")}
							</th>
							<th className="px-5 py-2" />
						</tr>
					</thead>
					<tbody>
						{!data
							? [0, 1, 2].map((i) => (
									<tr key={i} className="border-b border-border">
										<td colSpan={5} className="px-5 py-3">
											<Skeleton className="h-4 w-full" />
										</td>
									</tr>
								))
							: data.items.map((e) => (
									<tr
										key={e.id}
										className="border-b border-border last:border-b-0 hover:bg-primary-soft/40"
									>
										<td className="px-5 py-2.5 whitespace-nowrap">
											<RelativeTime date={e.timestamp} />
										</td>
										<td className="max-w-xs truncate px-3 py-2.5 font-mono text-xs">
											{e.message ?? e.type}
										</td>
										<td className="px-3 py-2.5 font-mono text-xs text-muted">
											{e.release ?? "—"}
										</td>
										<td className="max-w-40 truncate px-3 py-2.5 font-mono text-xs text-muted">
											{e.userIdentifier ?? "—"}
										</td>
										<td className="px-5 py-2.5 text-right">
											<button
												type="button"
												onClick={() => onView(e.id)}
												className="text-xs font-medium text-primary hover:underline"
											>
												{t("issue.events.view")}
											</button>
										</td>
									</tr>
								))}
					</tbody>
				</table>
			</Card>
			{data && (
				<Pagination
					offset={data.offset}
					limit={data.limit}
					total={data.total}
					onChange={setOffset}
				/>
			)}
		</div>
	);
}
