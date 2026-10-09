import {
	activityDtoSchema,
	activityListDtoSchema,
	eventDetailDtoSchema,
	eventListDtoSchema,
	issueDetailDtoSchema,
	issueDtoSchema,
	issueListDtoSchema,
	type ListActivityQuery,
	type ListIssuesQuery,
	type UpdateIssueInput,
} from "@sentinel/shared";
import { http } from "@/services/http/http";
import { base } from "@/services/issuesService/issuesService.constants";

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

	listActivity: (
		orgId: string,
		projectId: string,
		issueId: string,
		page: Partial<ListActivityQuery>,
	) =>
		http(`${base(orgId, projectId)}/${issueId}/activity`, {
			schema: activityListDtoSchema,
			query: page,
		}),

	addComment: (
		orgId: string,
		projectId: string,
		issueId: string,
		body: string,
	) =>
		http(`${base(orgId, projectId)}/${issueId}/comments`, {
			method: "POST",
			body: { body },
			schema: activityDtoSchema,
		}),

	editComment: (
		orgId: string,
		projectId: string,
		issueId: string,
		commentId: string,
		body: string,
	) =>
		http(`${base(orgId, projectId)}/${issueId}/comments/${commentId}`, {
			method: "PATCH",
			body: { body },
			schema: activityDtoSchema,
		}),

	deleteComment: (
		orgId: string,
		projectId: string,
		issueId: string,
		commentId: string,
	) =>
		http(`${base(orgId, projectId)}/${issueId}/comments/${commentId}`, {
			method: "DELETE",
		}),
};
