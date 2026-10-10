import { type StatsPeriod, statsDtoSchema } from "@sentinel/shared";
import { http } from "@/services/http/http";

const base = (orgId: string, projectId: string) =>
	`/api/organizations/${orgId}/projects/${projectId}`;

export const statsService = {
	project: (orgId: string, projectId: string, period: StatsPeriod) =>
		http(`${base(orgId, projectId)}/stats`, {
			schema: statsDtoSchema,
			query: { period },
		}),

	issue: (
		orgId: string,
		projectId: string,
		issueId: string,
		period: StatsPeriod,
	) =>
		http(`${base(orgId, projectId)}/issues/${issueId}/stats`, {
			schema: statsDtoSchema,
			query: { period },
		}),
};
