import type { ListIssuesQuery } from "@sentinel/shared";

// Claves de caché centralizadas: al invalidar un prefijo se invalida todo lo que cuelga de él.
export const queryKeys = {
	session: ["session"] as const,
	publicConfig: ["public-config"] as const,
	organizations: ["organizations"] as const,
	projects: (orgId: string) => ["orgs", orgId, "projects"] as const,
	project: (orgId: string, projectId: string) =>
		["orgs", orgId, "projects", projectId] as const,
	releases: (orgId: string, projectId: string) =>
		["orgs", orgId, "projects", projectId, "releases"] as const,
	artifacts: (orgId: string, projectId: string, version: string) =>
		[...queryKeys.releases(orgId, projectId), version, "artifacts"] as const,
	tokens: (orgId: string) => ["orgs", orgId, "tokens"] as const,
	environments: (orgId: string, projectId: string) =>
		["orgs", orgId, "projects", projectId, "environments"] as const,
	issues: (orgId: string, projectId: string) =>
		["orgs", orgId, "projects", projectId, "issues"] as const,
	issueList: (
		orgId: string,
		projectId: string,
		query: Partial<ListIssuesQuery>,
	) => [...queryKeys.issues(orgId, projectId), "list", query] as const,
	issue: (orgId: string, projectId: string, issueId: string) =>
		[...queryKeys.issues(orgId, projectId), "detail", issueId] as const,
	issueEvents: (
		orgId: string,
		projectId: string,
		issueId: string,
		page: object,
	) =>
		[...queryKeys.issues(orgId, projectId), "events", issueId, page] as const,
	issueEvent: (
		orgId: string,
		projectId: string,
		issueId: string,
		eventId: string,
	) =>
		[...queryKeys.issues(orgId, projectId), "event", issueId, eventId] as const,
};
