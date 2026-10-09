import { z } from "zod";
import { authClient } from "@/services/authClient/authClient";
import { ApiError } from "@/utils/apiError/apiError";
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
};
