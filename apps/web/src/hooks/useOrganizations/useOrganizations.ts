import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/hooks/queryKeys/queryKeys";
import i18n from "@/i18n";
import { organizationsService } from "@/services/organizationsService/organizationsService";
import type { AssignableRole } from "@/utils/invitation/invitationInterface";
import { notify } from "@/utils/notice/notice";

export function useOrganizations() {
	return useQuery({
		queryKey: queryKeys.organizations,
		queryFn: () => organizationsService.list(),
		staleTime: 60_000,
	});
}

export function useCreateOrganization() {
	const client = useQueryClient();
	return useMutation({
		mutationFn: (input: { name: string; slug: string }) =>
			organizationsService.create(input),
		onSuccess: () => {
			notify(i18n.t("notices.organizationCreated"));
			return client.invalidateQueries({ queryKey: queryKeys.organizations });
		},
	});
}

/** Miembros de la organización (para elegir destinatarios de un aviso, asignar, etc.). */
export function useMembers(orgId: string | undefined) {
	return useQuery({
		queryKey: queryKeys.members(orgId ?? ""),
		queryFn: () => organizationsService.listMembers(orgId as string),
		enabled: Boolean(orgId),
		staleTime: 60_000,
	});
}

export function useInvitations(orgId: string | undefined) {
	return useQuery({
		queryKey: queryKeys.invitations(orgId ?? ""),
		queryFn: () => organizationsService.listInvitations(orgId as string),
		enabled: Boolean(orgId),
		retry: false,
	});
}

export function useInviteMember(orgId: string) {
	const client = useQueryClient();
	return useMutation({
		mutationFn: (input: {
			email: string;
			role: AssignableRole;
			resend?: boolean;
		}) =>
			organizationsService.inviteMember({ organizationId: orgId, ...input }),
		onSuccess: (_data, variables) => {
			notify(
				i18n.t(
					variables.resend
						? "notices.invitationResent"
						: "notices.invitationSent",
				),
			);
			return client.invalidateQueries({
				queryKey: queryKeys.invitations(orgId),
			});
		},
	});
}

export function useCancelInvitation(orgId: string) {
	const client = useQueryClient();
	return useMutation({
		mutationFn: (invitationId: string) =>
			organizationsService.cancelInvitation(invitationId),
		onSuccess: () => {
			notify(i18n.t("notices.invitationCancelled"));
			return client.invalidateQueries({
				queryKey: queryKeys.invitations(orgId),
			});
		},
	});
}

export function useRemoveMember(orgId: string) {
	const client = useQueryClient();
	return useMutation({
		mutationFn: (memberId: string) =>
			organizationsService.removeMember(orgId, memberId),
		onSuccess: () => {
			notify(i18n.t("notices.memberRemoved"));
			return client.invalidateQueries({ queryKey: queryKeys.members(orgId) });
		},
	});
}

export function useUpdateMemberRole(orgId: string) {
	const client = useQueryClient();
	return useMutation({
		mutationFn: (vars: { memberId: string; role: AssignableRole }) =>
			organizationsService.updateMemberRole(orgId, vars.memberId, vars.role),
		onSuccess: () => {
			notify(i18n.t("notices.roleUpdated"));
			return client.invalidateQueries({ queryKey: queryKeys.members(orgId) });
		},
	});
}

/** Datos públicos de una invitación (organización, quién invita, rol) para quien la recibe. */
export function useInvitation(invitationId: string) {
	return useQuery({
		queryKey: queryKeys.invitation(invitationId),
		queryFn: () => organizationsService.getInvitation(invitationId),
		retry: false,
	});
}

export function useAcceptInvitation() {
	const client = useQueryClient();
	return useMutation({
		mutationFn: (invitationId: string) =>
			organizationsService.acceptInvitation(invitationId),
		// La lista de organizaciones cambia: hay que leerla de nuevo antes de entrar a la nueva.
		onSuccess: () => {
			notify(i18n.t("notices.invitationAccepted"));
			return client.fetchQuery({
				queryKey: queryKeys.organizations,
				queryFn: () => organizationsService.list(),
				staleTime: 0,
			});
		},
	});
}

export function useRejectInvitation() {
	return useMutation({
		mutationFn: (invitationId: string) =>
			organizationsService.rejectInvitation(invitationId),
		onSuccess: () => notify(i18n.t("notices.invitationDeclined")),
	});
}
