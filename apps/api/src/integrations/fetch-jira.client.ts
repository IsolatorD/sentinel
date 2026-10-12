import { Injectable } from "@nestjs/common";
import {
	JiraClient,
	type JiraCredentials,
	JiraError,
	type NewJiraIssue,
} from "./jira.client.js";

const TIMEOUT_MS = 10_000;

type Fetch = typeof fetch;

/** Habla con la API REST v3 de Jira Cloud con autenticación básica (correo + API token). */
@Injectable()
export class FetchJiraClient extends JiraClient {
	constructor(private readonly doFetch: Fetch = fetch) {
		super();
	}

	async verify(
		credentials: JiraCredentials,
		projectKey: string,
		issueType: string,
	): Promise<void> {
		const res = await this.request(
			credentials,
			`/rest/api/3/project/${encodeURIComponent(projectKey)}`,
		);
		if (res.status === 401 || res.status === 403)
			throw new JiraError("JIRA_AUTH_FAILED", String(res.status));
		if (res.status === 404) throw new JiraError("JIRA_PROJECT_NOT_FOUND");
		if (!res.ok)
			throw new JiraError("JIRA_REQUEST_FAILED", `status ${res.status}`);

		const body = (await res.json().catch(() => ({}))) as {
			issueTypes?: Array<{ name?: string }>;
		};
		const known = body.issueTypes?.map((t) => t.name?.toLowerCase());
		if (known && !known.includes(issueType.toLowerCase()))
			throw new JiraError("JIRA_ISSUE_TYPE_NOT_FOUND");
	}

	async createIssue(
		credentials: JiraCredentials,
		issue: NewJiraIssue,
	): Promise<{ key: string; url: string }> {
		const res = await this.request(credentials, "/rest/api/3/issue", {
			method: "POST",
			body: JSON.stringify({
				fields: {
					project: { key: issue.projectKey },
					issuetype: { name: issue.issueType },
					summary: issue.summary,
					description: issue.description,
					labels: ["sentinel"],
				},
			}),
		});
		if (res.status === 401 || res.status === 403)
			throw new JiraError("JIRA_AUTH_FAILED", String(res.status));
		if (res.status === 404) throw new JiraError("JIRA_PROJECT_NOT_FOUND");
		if (!res.ok) {
			// El detalle de Jira (campos obligatorios, etc.) va al log del servidor, no a la respuesta.
			const detail = (await res.text().catch(() => "")).slice(0, 500);
			throw new JiraError("JIRA_REQUEST_FAILED", `${res.status} ${detail}`);
		}
		const body = (await res.json().catch(() => ({}))) as { key?: string };
		if (!body.key)
			throw new JiraError("JIRA_REQUEST_FAILED", "no key returned");
		return { key: body.key, url: `${credentials.siteUrl}/browse/${body.key}` };
	}

	private async request(
		credentials: JiraCredentials,
		path: string,
		init: { method?: string; body?: string } = {},
	): Promise<Response> {
		const auth = Buffer.from(
			`${credentials.email}:${credentials.apiToken}`,
		).toString("base64");
		try {
			return await this.doFetch(`${credentials.siteUrl}${path}`, {
				method: init.method ?? "GET",
				body: init.body,
				headers: {
					Authorization: `Basic ${auth}`,
					Accept: "application/json",
					...(init.body && { "Content-Type": "application/json" }),
				},
				// El sitio ya está limitado a *.atlassian.net; no se sigue ninguna redirección a otro host.
				redirect: "error",
				signal: AbortSignal.timeout(TIMEOUT_MS),
			});
		} catch (error) {
			throw new JiraError("JIRA_REQUEST_FAILED", (error as Error).message);
		}
	}
}
