import {
	environmentListDtoSchema,
	releaseDtoSchema,
	releaseListDtoSchema,
} from "@sentinel/shared";
import { http } from "./http.js";

const base = (orgId: string, projectId: string) =>
	`/api/organizations/${orgId}/projects/${projectId}`;

export const releasesService = {
	list: (orgId: string, projectId: string) =>
		http(`${base(orgId, projectId)}/releases`, {
			schema: releaseListDtoSchema,
		}),

	get: (orgId: string, projectId: string, version: string) =>
		http(`${base(orgId, projectId)}/releases/${encodeURIComponent(version)}`, {
			schema: releaseDtoSchema,
		}),

	remove: (orgId: string, projectId: string, version: string) =>
		http(`${base(orgId, projectId)}/releases/${encodeURIComponent(version)}`, {
			method: "DELETE",
		}),

	environments: (orgId: string, projectId: string) =>
		http(`${base(orgId, projectId)}/environments`, {
			schema: environmentListDtoSchema,
		}),
};
