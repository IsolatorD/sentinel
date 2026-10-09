import type { IssueDto } from "@sentinel/shared";
import type { ReadyScope } from "@/hooks/useIssues/useIssuesInterface";

export interface IssueAssigneeProps {
	issue: IssueDto;
	scope: ReadyScope;
}
