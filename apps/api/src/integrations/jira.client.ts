export interface JiraCredentials {
	siteUrl: string;
	email: string;
	apiToken: string;
}

export type JiraErrorCode =
	| "JIRA_AUTH_FAILED"
	| "JIRA_PROJECT_NOT_FOUND"
	| "JIRA_ISSUE_TYPE_NOT_FOUND"
	| "JIRA_REQUEST_FAILED";

export class JiraError extends Error {
	constructor(
		readonly code: JiraErrorCode,
		detail?: string,
	) {
		super(detail ? `${code}: ${detail}` : code);
	}
}

export interface NewJiraIssue {
	projectKey: string;
	issueType: string;
	summary: string;
	/** Documento en Atlassian Document Format. */
	description: unknown;
}

/** Cliente de Jira Cloud. Es abstracto para poder sustituirlo por un doble en las pruebas. */
export abstract class JiraClient {
	/** Comprueba credenciales, que el proyecto exista y que el tipo de issue exista en él. */
	abstract verify(
		credentials: JiraCredentials,
		projectKey: string,
		issueType: string,
	): Promise<void>;

	abstract createIssue(
		credentials: JiraCredentials,
		issue: NewJiraIssue,
	): Promise<{ key: string; url: string }>;
}
