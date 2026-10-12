import type { IssueDetailDto } from "@sentinel/shared";
import type { ReadyScope } from "@/hooks/useIssues/useIssuesInterface";

export interface IssueTicketProps {
	issue: IssueDetailDto;
	scope: ReadyScope;
}
