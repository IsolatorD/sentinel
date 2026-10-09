import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/atoms/Card/Card";
import { Skeleton } from "@/components/atoms/Skeleton/Skeleton";
import { ActivityEvent } from "@/components/molecules/ActivityEvent/ActivityEvent";
import { ErrorState } from "@/components/molecules/ErrorState/ErrorState";
import { Pagination } from "@/components/molecules/Pagination/Pagination";
import { CommentComposer } from "@/components/organisms/IssueActivity/CommentComposer/CommentComposer";
import { PAGE } from "@/components/organisms/IssueActivity/IssueActivity.constants";
import type { IssueActivityProps } from "@/components/organisms/IssueActivity/IssueActivityInterface";
import { IssueComment } from "@/components/organisms/IssueActivity/IssueComment/IssueComment";
import { useIssueActivity } from "@/hooks/useIssues/useIssues";
import { useMembers } from "@/hooks/useOrganizations/useOrganizations";
import { isAdminRole } from "@/utils/roles/roles";

/** Comentarios y cambios de un issue, del más reciente al más antiguo, con la caja para comentar arriba. */
export function IssueActivity({
	scope,
	issueId,
	currentUserId,
}: IssueActivityProps) {
	const { t } = useTranslation();
	const [offset, setOffset] = useState(0);
	const activity = useIssueActivity(scope, issueId, { limit: PAGE, offset });
	const members = useMembers(scope.orgId);
	const me = members.data?.find((m) => m.userId === currentUserId);
	const canModerate = me ? isAdminRole(me.role) : false;

	return (
		<div className="space-y-4" data-testid="issue-activity">
			<Card className="p-4">
				<CommentComposer scope={scope} issueId={issueId} />
			</Card>
			{activity.isError ? (
				<ErrorState
					title={t("activity.loadError")}
					onRetry={() => activity.refetch()}
				/>
			) : !activity.data ? (
				<Skeleton className="h-24 w-full" />
			) : activity.data.items.length === 0 ? (
				<p
					className="py-6 text-center text-sm text-muted"
					data-testid="no-activity"
				>
					{t("activity.empty")}
				</p>
			) : (
				<Card className="px-4">
					<ul className="divide-y divide-border">
						{activity.data.items.map((entry) =>
							entry.type === "comment" ? (
								<IssueComment
									key={entry.id}
									comment={entry}
									scope={scope}
									issueId={issueId}
									currentUserId={currentUserId}
									canModerate={canModerate}
								/>
							) : (
								<ActivityEvent key={entry.id} entry={entry} />
							),
						)}
					</ul>
				</Card>
			)}
			{activity.data && (
				<Pagination
					offset={offset}
					limit={PAGE}
					total={activity.data.total}
					onChange={setOffset}
				/>
			)}
		</div>
	);
}
