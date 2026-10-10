import type {
	ListSamplesQuery,
	ListTransactionsQuery,
	OverviewQuery,
} from "@sentinel/shared";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/hooks/queryKeys/queryKeys";
import type { Scope } from "@/hooks/useIssues/useIssuesInterface";
import { performanceService } from "@/services/performanceService/performanceService";

export function useTransactions(
	scope: Scope,
	query: Partial<ListTransactionsQuery>,
) {
	const { orgId, projectId } = scope;
	return useQuery({
		queryKey: queryKeys.performanceTransactions(
			orgId ?? "",
			projectId ?? "",
			query,
		),
		queryFn: () =>
			performanceService.transactions(
				orgId as string,
				projectId as string,
				query,
			),
		enabled: Boolean(orgId && projectId),
		placeholderData: keepPreviousData,
	});
}

export function usePerformanceOverview(
	scope: Scope,
	query: Partial<OverviewQuery>,
) {
	const { orgId, projectId } = scope;
	return useQuery({
		queryKey: queryKeys.performanceOverview(
			orgId ?? "",
			projectId ?? "",
			query,
		),
		queryFn: () =>
			performanceService.overview(orgId as string, projectId as string, query),
		enabled: Boolean(orgId && projectId),
		placeholderData: keepPreviousData,
	});
}

export function useSamples(
	scope: Scope,
	query: Partial<ListSamplesQuery> & Pick<ListSamplesQuery, "name">,
) {
	const { orgId, projectId } = scope;
	return useQuery({
		queryKey: queryKeys.performanceSamples(orgId ?? "", projectId ?? "", query),
		queryFn: () =>
			performanceService.samples(orgId as string, projectId as string, query),
		enabled: Boolean(orgId && projectId && query.name),
		placeholderData: keepPreviousData,
	});
}

export function useSample(scope: Scope, transactionId: string | undefined) {
	const { orgId, projectId } = scope;
	return useQuery({
		queryKey: queryKeys.performanceSample(
			orgId ?? "",
			projectId ?? "",
			transactionId ?? "",
		),
		queryFn: () =>
			performanceService.sample(
				orgId as string,
				projectId as string,
				transactionId as string,
			),
		enabled: Boolean(orgId && projectId && transactionId),
	});
}

/** Una traza completa (las transacciones de cada servicio y los errores ocurridos durante ella). */
export function useTrace(scope: Scope, traceId: string | undefined) {
	const { orgId, projectId } = scope;
	return useQuery({
		queryKey: queryKeys.performanceTrace(
			orgId ?? "",
			projectId ?? "",
			traceId ?? "",
		),
		queryFn: () =>
			performanceService.trace(
				orgId as string,
				projectId as string,
				traceId as string,
			),
		enabled: Boolean(orgId && projectId && traceId),
	});
}
