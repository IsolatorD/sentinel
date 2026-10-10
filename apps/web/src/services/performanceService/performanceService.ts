import {
	type ListSamplesQuery,
	type ListTransactionsQuery,
	type OverviewQuery,
	performanceOverviewDtoSchema,
	sampleDetailDtoSchema,
	sampleListDtoSchema,
	transactionListDtoSchema,
} from "@sentinel/shared";
import { http } from "@/services/http/http";
import { base } from "@/services/performanceService/performanceService.constants";

export const performanceService = {
	transactions: (
		orgId: string,
		projectId: string,
		query: Partial<ListTransactionsQuery>,
	) =>
		http(`${base(orgId, projectId)}/transactions`, {
			schema: transactionListDtoSchema,
			query,
		}),

	overview: (orgId: string, projectId: string, query: Partial<OverviewQuery>) =>
		http(`${base(orgId, projectId)}/overview`, {
			schema: performanceOverviewDtoSchema,
			query,
		}),

	samples: (
		orgId: string,
		projectId: string,
		query: Partial<ListSamplesQuery> & Pick<ListSamplesQuery, "name">,
	) =>
		http(`${base(orgId, projectId)}/samples`, {
			schema: sampleListDtoSchema,
			query,
		}),

	sample: (orgId: string, projectId: string, transactionId: string) =>
		http(`${base(orgId, projectId)}/samples/${transactionId}`, {
			schema: sampleDetailDtoSchema,
		}),
};
