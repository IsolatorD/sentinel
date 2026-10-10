import {
	ALERTS_SEARCH_DEFAULTS,
	alertsSearchInputSchema,
	ISSUES_SEARCH_DEFAULTS,
	issueSearchInputSchema,
	issuesSearchInputSchema,
	PERFORMANCE_SEARCH_DEFAULTS,
	performanceSearchInputSchema,
	TRANSACTION_SEARCH_DEFAULTS,
	transactionSearchInputSchema,
} from "@/utils/searchParams/searchParams.constants";
import type {
	AlertsSearch,
	IssueSearch,
	IssuesSearch,
	PerformanceSearch,
	TransactionSearch,
} from "@/utils/searchParams/searchParamsInterface";

/** Lee los parámetros de la URL (cualquier cosa) y devuelve valores válidos con sus defaults. */
export function resolveIssuesSearch(raw: unknown): IssuesSearch {
	const input = issuesSearchInputSchema.parse(raw ?? {});
	return {
		status: input.status ?? ISSUES_SEARCH_DEFAULTS.status,
		q: input.q,
		level: input.level,
		environment: input.environment,
		release: input.release,
		assignee: input.assignee,
		sort: input.sort ?? ISSUES_SEARCH_DEFAULTS.sort,
		order: input.order ?? ISSUES_SEARCH_DEFAULTS.order,
		page: input.page ?? ISSUES_SEARCH_DEFAULTS.page,
	};
}

export function resolveIssueSearch(raw: unknown): IssueSearch {
	const input = issueSearchInputSchema.parse(raw ?? {});
	return { event: input.event, tab: input.tab ?? "details" };
}

export function resolveAlertsSearch(raw: unknown): AlertsSearch {
	const input = alertsSearchInputSchema.parse(raw ?? {});
	return {
		tab: input.tab ?? ALERTS_SEARCH_DEFAULTS.tab,
		page: input.page ?? ALERTS_SEARCH_DEFAULTS.page,
	};
}

export function resolvePerformanceSearch(raw: unknown): PerformanceSearch {
	const input = performanceSearchInputSchema.parse(raw ?? {});
	return {
		period: input.period ?? PERFORMANCE_SEARCH_DEFAULTS.period,
		environment: input.environment,
		release: input.release,
		q: input.q,
		sort: input.sort ?? PERFORMANCE_SEARCH_DEFAULTS.sort,
		order: input.order ?? PERFORMANCE_SEARCH_DEFAULTS.order,
		page: input.page ?? PERFORMANCE_SEARCH_DEFAULTS.page,
	};
}

export function resolveTransactionSearch(raw: unknown): TransactionSearch {
	const input = transactionSearchInputSchema.parse(raw ?? {});
	return {
		name: input.name,
		period: input.period ?? TRANSACTION_SEARCH_DEFAULTS.period,
		environment: input.environment,
		release: input.release,
		samples: input.samples ?? TRANSACTION_SEARCH_DEFAULTS.samples,
	};
}

/** Quita de la URL lo que vale lo mismo que el valor por defecto, para mantenerla corta. */
export function omitDefaults<T extends Record<string, unknown>>(
	search: T,
	defaults: Record<string, unknown>,
): Partial<T> {
	return Object.fromEntries(
		Object.entries(search).filter(
			([key, value]) => value !== undefined && value !== defaults[key],
		),
	) as Partial<T>;
}
