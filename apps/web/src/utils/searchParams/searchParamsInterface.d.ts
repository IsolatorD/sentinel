import type {
	ISSUE_SORTS,
	ISSUE_STATUSES,
	levelSchema,
	StatsPeriod,
	TRANSACTION_SORTS,
} from "@sentinel/shared";
import type { z } from "zod";
import type {
	ALERT_TABS,
	issueSearchInputSchema,
	issuesSearchInputSchema,
} from "@/utils/searchParams/searchParams.constants";

export type IssuesSearchInput = z.infer<typeof issuesSearchInputSchema>;

export interface IssuesSearch {
	status: (typeof ISSUE_STATUSES)[number] | "all";
	q?: string;
	level?: z.infer<typeof levelSchema>;
	environment?: string;
	release?: string;
	assignee?: string;
	sort: (typeof ISSUE_SORTS)[number];
	order: "asc" | "desc";
	page: number;
}

export type IssueSearchInput = z.infer<typeof issueSearchInputSchema>;

export interface IssueSearch {
	event?: string;
	tab: "details" | "events" | "activity";
}

export interface AlertsSearch {
	tab: (typeof ALERT_TABS)[number];
	page: number;
}

export interface PerformanceSearch {
	period: StatsPeriod;
	environment?: string;
	release?: string;
	q?: string;
	sort: (typeof TRANSACTION_SORTS)[number];
	order: "asc" | "desc";
	page: number;
}

export interface OverviewSearch {
	period: StatsPeriod;
	environment?: string;
}

export interface TransactionSearch {
	name?: string;
	period: StatsPeriod;
	environment?: string;
	release?: string;
	samples: "slowest" | "recent";
}
