import {
	type ConnectJiraInput,
	jiraConnectionDtoSchema,
	ticketDtoSchema,
} from "@sentinel/shared";
import { http } from "@/services/http/http";
import { projectBase } from "@/services/integrationsService/integrationsService.constants";

export const integrationsService = {
	getJira: (orgId: string, projectId: string) =>
		http(`${projectBase(orgId, projectId)}/integrations/jira`, {
			schema: jiraConnectionDtoSchema,
		}),

	/** `input` es lo que el usuario escribió (sin normalizar): el servidor lo valida y normaliza. */
	connectJira: (
		orgId: string,
		projectId: string,
		input: Omit<ConnectJiraInput, "issueType"> & { issueType?: string },
	) =>
		http(`${projectBase(orgId, projectId)}/integrations/jira`, {
			method: "PUT",
			body: input,
			schema: jiraConnectionDtoSchema,
		}),

	disconnectJira: (orgId: string, projectId: string) =>
		http(`${projectBase(orgId, projectId)}/integrations/jira`, {
			method: "DELETE",
		}),

	createTicket: (orgId: string, projectId: string, issueId: string) =>
		http(`${projectBase(orgId, projectId)}/issues/${issueId}/ticket`, {
			method: "POST",
			body: {},
			schema: ticketDtoSchema,
		}),

	unlinkTicket: (orgId: string, projectId: string, issueId: string) =>
		http(`${projectBase(orgId, projectId)}/issues/${issueId}/ticket`, {
			method: "DELETE",
		}),
};
