import {
	activityListDtoSchema,
	issueDetailDtoSchema,
	issueListDtoSchema,
	jiraConnectionDtoSchema,
} from "@sentinel/shared";
import { describe, expect, it } from "vitest";
import { db, scalar } from "../support/db.js";
import { eventually } from "../support/eventually.js";
import { createTenant, errorEvent, type Tenant } from "../support/factories.js";

/*
 * Jira Cloud solo se acepta en `https://*.atlassian.net`, así que no se puede apuntar a un servidor
 * local de pruebas: la conexión y la creación del ticket contra Jira se cubren con pruebas unitarias
 * (cliente y servicio). Aquí se comprueban permisos, validación y el vínculo ya guardado.
 */

const connection = (t: Tenant) => `${t.projectPath}/integrations/jira`;

async function withIssue() {
	const t = await createTenant();
	await t.client.ingest(
		t.projectId,
		t.key,
		errorEvent({ type: "TicketError" }),
	);
	await eventually(async () =>
		expect(
			await scalar("select count(*) from issue where project_id = $1", [
				t.projectId,
			]),
		).toBe(1),
	);
	const list = issueListDtoSchema.parse(
		(await t.client.get(`${t.projectPath}/issues?status=all`, t.owner)).json,
	);
	const issue = list.items[0];
	return { t, issue, path: `${t.projectPath}/issues/${issue.id}` };
}

const validBody = {
	siteUrl: "https://acme.atlassian.net",
	email: "ana@acme.test",
	apiToken: "tok",
	projectKey: "APP",
};

describe("conexión con Jira", () => {
	it("un proyecto nuevo no está conectado, y cualquier miembro puede verlo", async () => {
		const t = await createTenant();
		const member = await t.client.signUp("member");
		await t.client.addMember(t.owner, t.orgId, member, "member");
		const res = await t.client.get(connection(t), member);
		expect(res.status).toBe(200);
		expect(jiraConnectionDtoSchema.parse(res.json)).toEqual({
			connected: false,
			siteUrl: null,
			email: null,
			projectKey: null,
			issueType: null,
		});
		expect((await t.client.get(connection(t))).status).toBe(401);
	});

	it("solo owner/admin conectan o desconectan; los ajenos no ven nada", async () => {
		const t = await createTenant();
		const member = await t.client.signUp("member");
		await t.client.addMember(t.owner, t.orgId, member, "member");
		const outsider = await t.client.signUp("outsider");

		expect((await t.client.put(connection(t), validBody, member)).status).toBe(
			403,
		);
		expect((await t.client.delete(connection(t), member)).status).toBe(403);
		expect((await t.client.get(connection(t), outsider)).status).toBe(404);
	});

	it("solo acepta sitios de Jira Cloud y claves de proyecto válidas, antes de tocar la red", async () => {
		const t = await createTenant();
		const put = (body: Record<string, unknown>) =>
			t.client.put(connection(t), { ...validBody, ...body }, t.owner);
		for (const siteUrl of [
			"http://acme.atlassian.net", // sin https
			"https://evil.example.com",
			"https://acme.atlassian.net.evil.com",
			"https://127.0.0.1",
			"https://user:pass@acme.atlassian.net",
			"no-es-una-url",
		]) {
			const res = await put({ siteUrl });
			expect(res.status, siteUrl).toBe(400);
		}
		expect((await put({ projectKey: "1app" })).status).toBe(400);
		expect((await put({ email: "no-email" })).status).toBe(400);
		// Sin token la primera vez no hay nada que reutilizar.
		const noToken = await put({ apiToken: undefined });
		expect(noToken.status).toBe(400);
		expect(noToken.json.message).toMatch(/API token/);
	});

	it("desconectar sin conexión es 404", async () => {
		const t = await createTenant();
		expect((await t.client.delete(connection(t), t.owner)).status).toBe(404);
	});
});

describe("tickets de un issue", () => {
	it("crear un ticket sin conexión con Jira es un 400 claro", async () => {
		const { t, path } = await withIssue();
		const res = await t.client.post(`${path}/ticket`, {}, t.owner);
		expect(res.status).toBe(400);
		expect(res.json.message).toMatch(/not connected to Jira/);
	});

	it("el detalle del issue incluye su ticket, y desvincularlo queda en la actividad", async () => {
		const { t, issue, path } = await withIssue();
		expect(
			issueDetailDtoSchema.parse((await t.client.get(path, t.owner)).json)
				.ticket,
		).toBeNull();

		const ownerId = (await t.client.get("/api/auth/get-session", t.owner)).json
			.user.id;
		await db().query(
			"insert into issue_ticket (issue_id, external_key, external_url, created_by) values ($1, 'APP-7', 'https://acme.atlassian.net/browse/APP-7', $2)",
			[issue.id, ownerId],
		);
		const detail = issueDetailDtoSchema.parse(
			(await t.client.get(path, t.owner)).json,
		);
		expect(detail.ticket).toMatchObject({
			provider: "jira",
			key: "APP-7",
			url: "https://acme.atlassian.net/browse/APP-7",
			createdBy: { id: ownerId },
		});

		// Ya tiene ticket: crear otro es un conflicto (y no llega a llamar a Jira).
		const again = await t.client.post(`${path}/ticket`, {}, t.owner);
		expect([400, 409]).toContain(again.status);

		const unlink = await t.client.delete(`${path}/ticket`, t.owner);
		expect(unlink.status).toBe(204);
		expect(
			issueDetailDtoSchema.parse((await t.client.get(path, t.owner)).json)
				.ticket,
		).toBeNull();
		expect((await t.client.delete(`${path}/ticket`, t.owner)).status).toBe(404);

		const activity = activityListDtoSchema.parse(
			(await t.client.get(`${path}/activity`, t.owner)).json,
		);
		expect(activity.items[0]).toMatchObject({
			type: "ticket",
			data: { action: "unlinked", key: "APP-7" },
		});
	});

	it("un ticket ligado se borra junto con su issue", async () => {
		const { t, issue, path } = await withIssue();
		await db().query(
			"insert into issue_ticket (issue_id, external_key, external_url) values ($1, 'APP-8', 'https://acme.atlassian.net/browse/APP-8')",
			[issue.id],
		);
		expect((await t.client.delete(path, t.owner)).status).toBe(204);
		expect(
			await scalar("select count(*) from issue_ticket where issue_id = $1", [
				issue.id,
			]),
		).toBe(0);
	});

	it("los ajenos no pueden crear ni desvincular tickets", async () => {
		const { t, path } = await withIssue();
		const outsider = await t.client.signUp("outsider");
		expect((await t.client.post(`${path}/ticket`, {}, outsider)).status).toBe(
			404,
		);
		expect((await t.client.delete(`${path}/ticket`, outsider)).status).toBe(
			404,
		);
	});
});
