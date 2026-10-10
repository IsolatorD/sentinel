import { type DashboardQuery, dashboardDtoSchema } from "@sentinel/shared";
import { http } from "@/services/http/http";

export const dashboardService = {
	get: (orgId: string, projectId: string, query: Partial<DashboardQuery>) =>
		http(`/api/organizations/${orgId}/projects/${projectId}/dashboard`, {
			schema: dashboardDtoSchema,
			query,
		}),
};
