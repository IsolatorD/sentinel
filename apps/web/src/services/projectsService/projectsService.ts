import {
	type CreateProjectInput,
	type CreateProjectKeyInput,
	projectDtoSchema,
	projectKeyDtoSchema,
	type UpdateProjectInput,
	type UpdateProjectKeyInput,
	usageDtoSchema,
} from "@sentinel/shared";
import { z } from "zod";
import { http } from "@/services/http/http";
import { base } from "@/services/projectsService/projectsService.constants";

export const projectsService = {
	list: (orgId: string) =>
		http(base(orgId), { schema: z.array(projectDtoSchema) }),

	get: (orgId: string, projectId: string) =>
		http(`${base(orgId)}/${projectId}`, { schema: projectDtoSchema }),

	create: (orgId: string, input: CreateProjectInput) =>
		http(base(orgId), { body: input, schema: projectDtoSchema }),

	update: (orgId: string, projectId: string, input: UpdateProjectInput) =>
		http(`${base(orgId)}/${projectId}`, {
			method: "PATCH",
			body: input,
			schema: projectDtoSchema,
		}),

	usage: (orgId: string, projectId: string) =>
		http(`${base(orgId)}/${projectId}/usage`, { schema: usageDtoSchema }),

	remove: (orgId: string, projectId: string) =>
		http(`${base(orgId)}/${projectId}`, { method: "DELETE" }),

	createKey: (orgId: string, projectId: string, input: CreateProjectKeyInput) =>
		http(`${base(orgId)}/${projectId}/keys`, {
			body: input,
			schema: projectKeyDtoSchema,
		}),

	updateKey: (
		orgId: string,
		projectId: string,
		keyId: string,
		input: UpdateProjectKeyInput,
	) =>
		http(`${base(orgId)}/${projectId}/keys/${keyId}`, {
			method: "PATCH",
			body: input,
			schema: projectKeyDtoSchema,
		}),

	removeKey: (orgId: string, projectId: string, keyId: string) =>
		http(`${base(orgId)}/${projectId}/keys/${keyId}`, { method: "DELETE" }),
};
