import { z } from "zod";
import { ApiError } from "@/lib/api-error";
import { type Organization, organizationSchema } from "@/lib/organization";
import { authClient } from "./auth-client.js";

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
};
