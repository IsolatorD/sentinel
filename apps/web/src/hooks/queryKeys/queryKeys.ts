import type { ListIssuesQuery } from "@sentinel/shared";

// Claves de caché centralizadas: al invalidar un prefijo se invalida todo lo que cuelga de él.
export const queryKeys = {
	session: ["session"] as const,
	publicConfig: ["public-config"] as const,
	preferences: ["preferences"] as const,
	organizations: ["organizations"] as const,
	projects: (orgId: string) => ["orgs", orgId, "projects"] as const,
	dashboard: (orgId: string, projectId: string, query: object) =>
		["orgs", orgId, "projects", projectId, "dashboard", query] as const,
	usage: (orgId: string, projectId: string) =>
		["orgs", orgId, "projects", projectId, "usage"] as const,
	jira: (orgId: string, projectId: string) =>
		["orgs", orgId, "projects", projectId, "integrations", "jira"] as const,
	project: (orgId: string, projectId: string) =>
		["orgs", orgId, "projects", projectId] as const,
	releases: (orgId: string, projectId: string) =>
		["orgs", orgId, "projects", projectId, "releases"] as const,
	artifacts: (orgId: string, projectId: string, version: string) =>
		[...queryKeys.releases(orgId, projectId), version, "artifacts"] as const,
	alertChannels: (orgId: string, projectId: string) =>
		["orgs", orgId, "projects", projectId, "alerts", "channels"] as const,
	alertRules: (orgId: string, projectId: string) =>
		["orgs", orgId, "projects", projectId, "alerts", "rules"] as const,
	alertDeliveries: (orgId: string, projectId: string, page?: object) =>
		[
			"orgs",
			orgId,
			"projects",
			projectId,
			"alerts",
			"deliveries",
			...(page ? [page] : []),
		] as const,
	members: (orgId: string) => ["orgs", orgId, "members"] as const,
	invitations: (orgId: string) => ["orgs", orgId, "invitations"] as const,
	invitation: (invitationId: string) => ["invitation", invitationId] as const,
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
	performance: (orgId: string, projectId: string) =>
		["orgs", orgId, "projects", projectId, "performance"] as const,
	performanceTransactions: (orgId: string, projectId: string, query: object) =>
		[
			...queryKeys.performance(orgId, projectId),
			"transactions",
			query,
		] as const,
	performanceOverview: (orgId: string, projectId: string, query: object) =>
		[...queryKeys.performance(orgId, projectId), "overview", query] as const,
	performanceSamples: (orgId: string, projectId: string, query: object) =>
		[...queryKeys.performance(orgId, projectId), "samples", query] as const,
	performanceTrace: (orgId: string, projectId: string, traceId: string) =>
		[...queryKeys.performance(orgId, projectId), "trace", traceId] as const,
	performanceSample: (orgId: string, projectId: string, id: string) =>
		[...queryKeys.performance(orgId, projectId), "sample", id] as const,
	projectStats: (orgId: string, projectId: string, period: string) =>
		["orgs", orgId, "projects", projectId, "stats", period] as const,
	issueStats: (
		orgId: string,
		projectId: string,
		issueId: string,
		period: string,
	) =>
		[...queryKeys.issues(orgId, projectId), "stats", issueId, period] as const,
	issue: (orgId: string, projectId: string, issueId: string) =>
		[...queryKeys.issues(orgId, projectId), "detail", issueId] as const,
	issueEvents: (
		orgId: string,
		projectId: string,
		issueId: string,
		page: object,
	) =>
		[...queryKeys.issues(orgId, projectId), "events", issueId, page] as const,
	issueActivity: (
		orgId: string,
		projectId: string,
		issueId: string,
		page?: object,
	) =>
		[
			...queryKeys.issues(orgId, projectId),
			"activity",
			issueId,
			...(page ? [page] : []),
		] as const,
	issueEvent: (
		orgId: string,
		projectId: string,
		issueId: string,
		eventId: string,
	) =>
		[...queryKeys.issues(orgId, projectId), "event", issueId, eventId] as const,
};
