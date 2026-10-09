import type { IssueDetailDto } from "@sentinel/shared";
import type { ReadyScope } from "@/hooks/useIssues/useIssuesInterface";

export interface IssueHeaderProps {
	issue: IssueDetailDto;
	scope: ReadyScope;
	orgSlug: string;
	projectSlug: string;
}
