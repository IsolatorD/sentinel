import type { DashboardQuery } from "@sentinel/shared";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/hooks/queryKeys/queryKeys";
import type { Scope } from "@/hooks/useIssues/useIssuesInterface";
import { dashboardService } from "@/services/dashboardService/dashboardService";

export function useDashboard(scope: Scope, query: Partial<DashboardQuery>) {
	const { orgId, projectId } = scope;
	return useQuery({
		queryKey: queryKeys.dashboard(orgId ?? "", projectId ?? "", query),
		queryFn: () =>
			dashboardService.get(orgId as string, projectId as string, query),
		enabled: Boolean(orgId && projectId),
		placeholderData: keepPreviousData,
	});
}
