import type { ReadyScope } from "@/hooks/useIssues/useIssuesInterface";

export interface CommentComposerProps {
	scope: ReadyScope;
	issueId: string;
}
