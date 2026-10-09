import { z } from "zod";
import { authClient } from "@/services/authClient/authClient";
import { unwrap } from "@/services/authService/authService.constants";
import { ApiError } from "@/utils/apiError/apiError";
import {
	invitationSchema,
	publicInvitationSchema,
} from "@/utils/invitation/invitation.constants";
import type {
	AssignableRole,
	OrgInvitation,
	PublicInvitation,
} from "@/utils/invitation/invitationInterface";
import { membersResponseSchema } from "@/utils/member/member.constants";
import type { OrgMember } from "@/utils/member/memberInterface";
import { organizationSchema } from "@/utils/organization/organization.constants";
import type { Organization } from "@/utils/organization/organizationInterface";

export const organizationsService = {
	async list(): Promise<Organization[]> {
		const { data, error } = await authClient.organization.list();
		if (error)
			throw new ApiError(
				error.status,
				error.message ?? "Request failed",
				error.code,
			);
		return z.array(organizationSchema).parse(data ?? []);
	},

	async create(input: { name: string; slug: string }): Promise<Organization> {
		const { data, error } = await authClient.organization.create(input);
		if (error)
			throw new ApiError(
				error.status,
				error.message ?? "Request failed",
				error.code,
			);
		return organizationSchema.parse(data);
	},

	async listMembers(organizationId: string): Promise<OrgMember[]> {
		const { data, error } = await authClient.organization.listMembers({
			query: { organizationId },
		});
		if (error)
			throw new ApiError(
				error.status,
				error.message ?? "Request failed",
				error.code,
			);
		return membersResponseSchema.parse(data).members;
	},

	async listInvitations(organizationId: string): Promise<OrgInvitation[]> {
		const data = unwrap(
			await authClient.organization.listInvitations({
				query: { organizationId },
			}),
		);
		return z
			.array(invitationSchema)
			.parse(data ?? [])
			.filter((i) => i.status === "pending");
	},

	/** Invita por correo; `resend` reenvía la invitación pendiente de esa dirección. */
	async inviteMember(input: {
		organizationId: string;
		email: string;
		role: AssignableRole;
		resend?: boolean;
	}): Promise<void> {
		unwrap(await authClient.organization.inviteMember(input));
	},

	async cancelInvitation(invitationId: string): Promise<void> {
		unwrap(await authClient.organization.cancelInvitation({ invitationId }));
	},

	async removeMember(
		organizationId: string,
		memberIdOrEmail: string,
	): Promise<void> {
		unwrap(
			await authClient.organization.removeMember({
				organizationId,
				memberIdOrEmail,
			}),
		);
	},

	async updateMemberRole(
		organizationId: string,
		memberId: string,
		role: AssignableRole,
	): Promise<void> {
		unwrap(
			await authClient.organization.updateMemberRole({
				organizationId,
				memberId,
				role,
			}),
		);
	},

	async getInvitation(id: string): Promise<PublicInvitation> {
		const data = unwrap(
			await authClient.organization.getInvitation({ query: { id } }),
		);
		return publicInvitationSchema.parse(data);
	},

	async acceptInvitation(invitationId: string): Promise<void> {
		unwrap(await authClient.organization.acceptInvitation({ invitationId }));
	},

	async rejectInvitation(invitationId: string): Promise<void> {
		unwrap(await authClient.organization.rejectInvitation({ invitationId }));
	},
};
