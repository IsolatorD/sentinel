export const base = (orgId: string, projectId: string) =>
	`/api/organizations/${orgId}/projects/${projectId}`;

export const releasePath = (
	orgId: string,
	projectId: string,
	version: string,
) => `${base(orgId, projectId)}/releases/${encodeURIComponent(version)}`;
