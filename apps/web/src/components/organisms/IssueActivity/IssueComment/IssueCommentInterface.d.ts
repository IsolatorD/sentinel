import type { ActivityDto } from "@sentinel/shared";
import type { ReadyScope } from "@/hooks/useIssues/useIssuesInterface";

export interface IssueCommentProps {
	comment: ActivityDto;
	scope: ReadyScope;
	issueId: string;
	/** Quien edita su propio comentario; un owner/admin solo puede borrar. */
	currentUserId: string;
	canModerate: boolean;
}
