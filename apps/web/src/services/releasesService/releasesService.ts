import {
	artifactListDtoSchema,
	environmentListDtoSchema,
	releaseDtoSchema,
	releaseListDtoSchema,
} from "@sentinel/shared";
import { http } from "@/services/http/http";
import {
	base,
	releasePath,
} from "@/services/releasesService/releasesService.constants";

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

	artifacts: (orgId: string, projectId: string, version: string) =>
		http(`${releasePath(orgId, projectId, version)}/artifacts`, {
			schema: artifactListDtoSchema,
		}),

	removeArtifact: (
		orgId: string,
		projectId: string,
		version: string,
		artifactId: string,
	) =>
		http(`${releasePath(orgId, projectId, version)}/artifacts/${artifactId}`, {
			method: "DELETE",
		}),

	environments: (orgId: string, projectId: string) =>
		http(`${base(orgId, projectId)}/environments`, {
			schema: environmentListDtoSchema,
		}),
};
