import type { ConnectJiraInput } from "@sentinel/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/hooks/queryKeys/queryKeys";
import type { ReadyScope } from "@/hooks/useIssues/useIssuesInterface";
import { integrationsService } from "@/services/integrationsService/integrationsService";

/** Estado de la conexión del proyecto con Jira (sin el token, que nunca llega al navegador). */
export function useJiraConnection(
	orgId: string | undefined,
	projectId: string | undefined,
) {
	return useQuery({
		queryKey: queryKeys.jira(orgId ?? "", projectId ?? ""),
		queryFn: () =>
			integrationsService.getJira(orgId as string, projectId as string),
		enabled: Boolean(orgId && projectId),
	});
}

export function useConnectJira(orgId: string, projectId: string) {
	const client = useQueryClient();
	return useMutation({
		mutationFn: (
			input: Omit<ConnectJiraInput, "issueType"> & { issueType?: string },
		) => integrationsService.connectJira(orgId, projectId, input),
		onSuccess: (saved) =>
			client.setQueryData(queryKeys.jira(orgId, projectId), saved),
	});
}

export function useDisconnectJira(orgId: string, projectId: string) {
	const client = useQueryClient();
	return useMutation({
		mutationFn: () => integrationsService.disconnectJira(orgId, projectId),
		onSuccess: () =>
			client.invalidateQueries({ queryKey: queryKeys.jira(orgId, projectId) }),
	});
}

/** Crear o quitar un ticket cambia el detalle del issue y añade una línea a su actividad. */
function useRefreshIssue(scope: ReadyScope, issueId: string) {
	const client = useQueryClient();
	return () =>
		Promise.all([
			client.invalidateQueries({
				queryKey: queryKeys.issue(scope.orgId, scope.projectId, issueId),
			}),
			client.invalidateQueries({
				queryKey: queryKeys.issueActivity(
					scope.orgId,
					scope.projectId,
					issueId,
				),
			}),
		]);
}

export function useCreateTicket(scope: ReadyScope, issueId: string) {
	const refresh = useRefreshIssue(scope, issueId);
	return useMutation({
		mutationFn: () =>
			integrationsService.createTicket(scope.orgId, scope.projectId, issueId),
		onSuccess: refresh,
	});
}

export function useUnlinkTicket(scope: ReadyScope, issueId: string) {
	const refresh = useRefreshIssue(scope, issueId);
	return useMutation({
		mutationFn: () =>
			integrationsService.unlinkTicket(scope.orgId, scope.projectId, issueId),
		onSuccess: refresh,
	});
}
