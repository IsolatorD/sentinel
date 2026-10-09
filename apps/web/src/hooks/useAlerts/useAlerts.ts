import type {
	CreateChannelInput,
	CreateRuleInput,
	UpdateChannelInput,
	UpdateRuleInput,
} from "@sentinel/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/hooks/queryKeys/queryKeys";
import type { ReadyScope, Scope } from "@/hooks/useAlerts/useAlertsInterface";
import { alertsService } from "@/services/alertsService/alertsService";

export function useAlertChannels(scope: Scope) {
	const { orgId, projectId } = scope;
	return useQuery({
		queryKey: queryKeys.alertChannels(orgId ?? "", projectId ?? ""),
		queryFn: () =>
			alertsService.listChannels(orgId as string, projectId as string),
		enabled: Boolean(orgId && projectId),
		retry: false,
	});
}

export function useAlertRules(scope: Scope) {
	const { orgId, projectId } = scope;
	return useQuery({
		queryKey: queryKeys.alertRules(orgId ?? "", projectId ?? ""),
		queryFn: () =>
			alertsService.listRules(orgId as string, projectId as string),
		enabled: Boolean(orgId && projectId),
		retry: false,
	});
}

export function useAlertDeliveries(
	scope: Scope,
	page: { limit: number; offset: number },
) {
	const { orgId, projectId } = scope;
	return useQuery({
		queryKey: queryKeys.alertDeliveries(orgId ?? "", projectId ?? "", page),
		queryFn: () =>
			alertsService.listDeliveries(orgId as string, projectId as string, page),
		enabled: Boolean(orgId && projectId),
		retry: false,
		// El historial cambia solo (el worker entrega en segundo plano).
		refetchInterval: 5_000,
	});
}

/** Invalida varias consultas a la vez. */
function useInvalidate() {
	const client = useQueryClient();
	return (keys: Array<readonly unknown[]>) =>
		Promise.all(keys.map((queryKey) => client.invalidateQueries({ queryKey })));
}

export function useCreateChannel(scope: ReadyScope) {
	const invalidate = useInvalidate();
	return useMutation({
		mutationFn: (input: CreateChannelInput) =>
			alertsService.createChannel(scope.orgId, scope.projectId, input),
		onSuccess: () =>
			invalidate([queryKeys.alertChannels(scope.orgId, scope.projectId)]),
	});
}

export function useUpdateChannel(scope: ReadyScope) {
	const invalidate = useInvalidate();
	return useMutation({
		mutationFn: (vars: { channelId: string; input: UpdateChannelInput }) =>
			alertsService.updateChannel(
				scope.orgId,
				scope.projectId,
				vars.channelId,
				vars.input,
			),
		onSuccess: () =>
			invalidate([queryKeys.alertChannels(scope.orgId, scope.projectId)]),
	});
}

export function useDeleteChannel(scope: ReadyScope) {
	const invalidate = useInvalidate();
	return useMutation({
		mutationFn: (channelId: string) =>
			alertsService.deleteChannel(scope.orgId, scope.projectId, channelId),
		// Las reglas guardan sus canales: también cambian.
		onSuccess: () =>
			invalidate([
				queryKeys.alertChannels(scope.orgId, scope.projectId),
				queryKeys.alertRules(scope.orgId, scope.projectId),
			]),
	});
}

export function useTestChannel(scope: ReadyScope) {
	const invalidate = useInvalidate();
	return useMutation({
		mutationFn: (channelId: string) =>
			alertsService.testChannel(scope.orgId, scope.projectId, channelId),
		onSuccess: () =>
			invalidate([queryKeys.alertDeliveries(scope.orgId, scope.projectId)]),
	});
}

export function useCreateRule(scope: ReadyScope) {
	const invalidate = useInvalidate();
	return useMutation({
		mutationFn: (input: CreateRuleInput) =>
			alertsService.createRule(scope.orgId, scope.projectId, input),
		onSuccess: () =>
			invalidate([queryKeys.alertRules(scope.orgId, scope.projectId)]),
	});
}

export function useUpdateRule(scope: ReadyScope) {
	const invalidate = useInvalidate();
	return useMutation({
		mutationFn: (vars: { ruleId: string; input: UpdateRuleInput }) =>
			alertsService.updateRule(
				scope.orgId,
				scope.projectId,
				vars.ruleId,
				vars.input,
			),
		onSuccess: () =>
			invalidate([queryKeys.alertRules(scope.orgId, scope.projectId)]),
	});
}

export function useDeleteRule(scope: ReadyScope) {
	const invalidate = useInvalidate();
	return useMutation({
		mutationFn: (ruleId: string) =>
			alertsService.deleteRule(scope.orgId, scope.projectId, ruleId),
		onSuccess: () =>
			invalidate([queryKeys.alertRules(scope.orgId, scope.projectId)]),
	});
}
