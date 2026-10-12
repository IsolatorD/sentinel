import { describe, expect, it, vi } from "vitest";
import { FetchJiraClient } from "./fetch-jira.client.js";
import { JiraError } from "./jira.client.js";

const creds = {
	siteUrl: "https://acme.atlassian.net",
	email: "ana@acme.test",
	apiToken: "tok",
};

const json = (status: number, body: unknown = {}) =>
	new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json" },
	});

function client(response: Response | Error) {
	const doFetch = vi.fn(async () => {
		if (response instanceof Error) throw response;
		return response;
	});
	return {
		doFetch,
		client: new FetchJiraClient(doFetch as unknown as typeof fetch),
	};
}

const codeOf = async (promise: Promise<unknown>) => {
	try {
		await promise;
	} catch (error) {
		return (error as JiraError).code;
	}
	return undefined;
};

describe("FetchJiraClient.verify", () => {
	it("autentica con correo y token, sin seguir redirecciones", async () => {
		const { client: c, doFetch } = client(
			json(200, { issueTypes: [{ name: "Bug" }, { name: "Task" }] }),
		);
		await c.verify(creds, "APP", "bug");
		const [url, init] = doFetch.mock.calls[0] as unknown as [
			string,
			RequestInit,
		];
		expect(url).toBe("https://acme.atlassian.net/rest/api/3/project/APP");
		expect((init.headers as Record<string, string>).Authorization).toBe(
			`Basic ${Buffer.from("ana@acme.test:tok").toString("base64")}`,
		);
		expect(init.redirect).toBe("error");
	});

	it("traduce los fallos de Jira a códigos", async () => {
		expect(
			await codeOf(client(json(401)).client.verify(creds, "APP", "Bug")),
		).toBe("JIRA_AUTH_FAILED");
		expect(
			await codeOf(client(json(404)).client.verify(creds, "APP", "Bug")),
		).toBe("JIRA_PROJECT_NOT_FOUND");
		expect(
			await codeOf(client(json(500)).client.verify(creds, "APP", "Bug")),
		).toBe("JIRA_REQUEST_FAILED");
		expect(
			await codeOf(
				client(new Error("connect ETIMEDOUT")).client.verify(
					creds,
					"APP",
					"Bug",
				),
			),
		).toBe("JIRA_REQUEST_FAILED");
	});

	it("avisa si el tipo de issue no existe en el proyecto", async () => {
		const { client: c } = client(json(200, { issueTypes: [{ name: "Task" }] }));
		expect(await codeOf(c.verify(creds, "APP", "Bug"))).toBe(
			"JIRA_ISSUE_TYPE_NOT_FOUND",
		);
	});
});

describe("FetchJiraClient.createIssue", () => {
	const issue = {
		projectKey: "APP",
		issueType: "Bug",
		summary: "TypeError: boom",
		description: { type: "doc", version: 1, content: [] },
	};

	it("crea el ticket y devuelve su clave y su enlace", async () => {
		const { client: c, doFetch } = client(
			json(201, { key: "APP-12", id: "1" }),
		);
		expect(await c.createIssue(creds, issue)).toEqual({
			key: "APP-12",
			url: "https://acme.atlassian.net/browse/APP-12",
		});
		const [, init] = doFetch.mock.calls[0] as unknown as [string, RequestInit];
		const sent = JSON.parse(init.body as string);
		expect(sent.fields).toMatchObject({
			project: { key: "APP" },
			issuetype: { name: "Bug" },
			summary: "TypeError: boom",
			labels: ["sentinel"],
		});
	});

	it("un rechazo de Jira no filtra su detalle en el mensaje de cara al usuario, solo en el error interno", async () => {
		const { client: c } = client(
			json(400, { errors: { customfield_1: "required" } }),
		);
		const error = await c
			.createIssue(creds, issue)
			.catch((e) => e as JiraError);
		expect((error as JiraError).code).toBe("JIRA_REQUEST_FAILED");
		expect((error as JiraError).message).toContain("customfield_1");
	});

	it("traduce credenciales rechazadas y respuestas sin clave", async () => {
		expect(
			await codeOf(client(json(401)).client.createIssue(creds, issue)),
		).toBe("JIRA_AUTH_FAILED");
		expect(
			await codeOf(client(json(201, {})).client.createIssue(creds, issue)),
		).toBe("JIRA_REQUEST_FAILED");
	});
});
