import type { StatsPeriod } from "@sentinel/shared";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/hooks/queryKeys/queryKeys";
import type { Scope } from "@/hooks/useIssues/useIssuesInterface";
import { statsService } from "@/services/statsService/statsService";

export function useProjectStats(scope: Scope, period: StatsPeriod) {
	const { orgId, projectId } = scope;
	return useQuery({
		queryKey: queryKeys.projectStats(orgId ?? "", projectId ?? "", period),
		queryFn: () =>
			statsService.project(orgId as string, projectId as string, period),
		enabled: Boolean(orgId && projectId),
		placeholderData: keepPreviousData,
	});
}

export function useIssueStats(
	scope: Scope,
	issueId: string | undefined,
	period: StatsPeriod,
) {
	const { orgId, projectId } = scope;
	return useQuery({
		queryKey: queryKeys.issueStats(
			orgId ?? "",
			projectId ?? "",
			issueId ?? "",
			period,
		),
		queryFn: () =>
			statsService.issue(
				orgId as string,
				projectId as string,
				issueId as string,
				period,
			),
		enabled: Boolean(orgId && projectId && issueId),
		placeholderData: keepPreviousData,
	});
}
