import {
	eventDetailDtoSchema,
	eventListDtoSchema,
	issueDetailDtoSchema,
	issueDtoSchema,
	issueListDtoSchema,
	type ListIssuesQuery,
	type UpdateIssueInput,
} from "@sentinel/shared";
import { http } from "./http.js";

const base = (orgId: string, projectId: string) =>
	`/api/organizations/${orgId}/projects/${projectId}/issues`;

export const issuesService = {
	list: (orgId: string, projectId: string, query: Partial<ListIssuesQuery>) =>
		http(base(orgId, projectId), { schema: issueListDtoSchema, query }),

	get: (orgId: string, projectId: string, issueId: string) =>
		http(`${base(orgId, projectId)}/${issueId}`, {
			schema: issueDetailDtoSchema,
		}),

	updateStatus: (
		orgId: string,
		projectId: string,
		issueId: string,
		input: UpdateIssueInput,
	) =>
		http(`${base(orgId, projectId)}/${issueId}`, {
			method: "PATCH",
			body: input,
			schema: issueDtoSchema,
		}),

	remove: (orgId: string, projectId: string, issueId: string) =>
		http(`${base(orgId, projectId)}/${issueId}`, { method: "DELETE" }),

	listEvents: (
		orgId: string,
		projectId: string,
		issueId: string,
		page: { limit?: number; offset?: number },
	) =>
		http(`${base(orgId, projectId)}/${issueId}/events`, {
			schema: eventListDtoSchema,
			query: page,
		}),

	getEvent: (
		orgId: string,
		projectId: string,
		issueId: string,
		eventId: string,
	) =>
		http(`${base(orgId, projectId)}/${issueId}/events/${eventId}`, {
			schema: eventDetailDtoSchema,
		}),
};
