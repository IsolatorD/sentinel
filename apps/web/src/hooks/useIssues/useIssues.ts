import type { ListIssuesQuery, UpdateIssueInput } from "@sentinel/shared";
import {
	keepPreviousData,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { queryKeys } from "@/hooks/queryKeys/queryKeys";
import type { ReadyScope, Scope } from "@/hooks/useIssues/useIssuesInterface";
import { issuesService } from "@/services/issuesService/issuesService";

export function useIssues(scope: Scope, query: Partial<ListIssuesQuery>) {
	const { orgId, projectId } = scope;
	return useQuery({
		queryKey: queryKeys.issueList(orgId ?? "", projectId ?? "", query),
		queryFn: () =>
			issuesService.list(orgId as string, projectId as string, query),
		enabled: Boolean(orgId && projectId),
		// Al cambiar de página o de filtro se sigue mostrando la lista anterior mientras carga la nueva.
		placeholderData: keepPreviousData,
	});
}

export function useIssue(scope: Scope, issueId: string | undefined) {
	const { orgId, projectId } = scope;
	return useQuery({
		queryKey: queryKeys.issue(orgId ?? "", projectId ?? "", issueId ?? ""),
		queryFn: () =>
			issuesService.get(
				orgId as string,
				projectId as string,
				issueId as string,
			),
		enabled: Boolean(orgId && projectId && issueId),
	});
}

export function useIssueEvents(
	scope: Scope,
	issueId: string | undefined,
	page: { limit: number; offset: number },
) {
	const { orgId, projectId } = scope;
	return useQuery({
		queryKey: queryKeys.issueEvents(
			orgId ?? "",
			projectId ?? "",
			issueId ?? "",
			page,
		),
		queryFn: () =>
			issuesService.listEvents(
				orgId as string,
				projectId as string,
				issueId as string,
				page,
			),
		enabled: Boolean(orgId && projectId && issueId),
		placeholderData: keepPreviousData,
	});
}

/** Evento concreto de un issue (para navegar por sus ocurrencias). */
export function useIssueEvent(
	scope: Scope,
	issueId: string | undefined,
	eventId: string | undefined,
) {
	const { orgId, projectId } = scope;
	return useQuery({
		queryKey: queryKeys.issueEvent(
			orgId ?? "",
			projectId ?? "",
			issueId ?? "",
			eventId ?? "",
		),
		queryFn: () =>
			issuesService.getEvent(
				orgId as string,
				projectId as string,
				issueId as string,
				eventId as string,
			),
		enabled: Boolean(orgId && projectId && issueId && eventId),
	});
}

export function useUpdateIssueStatus(scope: ReadyScope, issueId: string) {
	const client = useQueryClient();
	return useMutation({
		mutationFn: (input: UpdateIssueInput) =>
			issuesService.updateStatus(scope.orgId, scope.projectId, issueId, input),
		onSuccess: () =>
			// Cambia el estado: afecta al detalle y a todas las listas filtradas.
			client.invalidateQueries({
				queryKey: queryKeys.issues(scope.orgId, scope.projectId),
			}),
	});
}

export function useDeleteIssue(scope: ReadyScope, issueId: string) {
	const client = useQueryClient();
	return useMutation({
		mutationFn: () =>
			issuesService.remove(scope.orgId, scope.projectId, issueId),
		onSuccess: () => {
			client.removeQueries({
				queryKey: queryKeys.issue(scope.orgId, scope.projectId, issueId),
			});
			return client.invalidateQueries({
				queryKey: queryKeys.issues(scope.orgId, scope.projectId),
			});
		},
	});
}
