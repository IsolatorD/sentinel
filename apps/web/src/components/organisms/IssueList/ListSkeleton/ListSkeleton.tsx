import { Skeleton } from "@/components/atoms/Skeleton/Skeleton";
import { ISSUE_GRID } from "@/components/molecules/IssueListItem/IssueListItem.constants";
import { cn } from "@/utils/cn/cn";

export function ListSkeleton() {
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
