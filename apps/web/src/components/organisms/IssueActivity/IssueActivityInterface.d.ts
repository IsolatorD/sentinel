import type { ReadyScope } from "@/hooks/useIssues/useIssuesInterface";

export interface IssueActivityProps {
	scope: ReadyScope;
	issueId: string;
	currentUserId: string;
}
