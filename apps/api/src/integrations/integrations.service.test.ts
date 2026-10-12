import {
	BadGatewayException,
	BadRequestException,
	ConflictException,
	ForbiddenException,
	NotFoundException,
} from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import { describe, expect, it, vi } from "vitest";
import type { ActivityService } from "../issues/activity/activity.service.js";
import type { OrgAccessService } from "../organizations/org-access.service.js";
import type { ProjectsService } from "../projects/projects.service.js";
import type {
	IntegrationsRepository,
	JiraRow,
	TicketRow,
} from "./integrations.repository.js";
import { IntegrationsService } from "./integrations.service.js";
import { JiraClient, JiraError } from "./jira.client.js";
import { SecretBox } from "./secret-box.js";

const SECRET = "test-secret-0123456789-abcdefghijklmnop";
const box = new SecretBox(SECRET);
const PROJECT = "11111111-1111-4111-8111-111111111111";
const ISSUE = "22222222-2222-4222-8222-222222222222";
const input = {
	siteUrl: "https://acme.atlassian.net",
	email: "ana@acme.test",
	apiToken: "tok-1",
	projectKey: "APP",
	issueType: "Bug",
};

const connection = (over: Partial<JiraRow> = {}): JiraRow => ({
	projectId: PROJECT,
	siteUrl: input.siteUrl,
	email: input.email,
	apiTokenEncrypted: box.encrypt("tok-1"),
	jiraProjectKey: "APP",
	issueType: "Bug",
	createdAt: new Date(),
	updatedAt: new Date(),
	...over,
});

const ticketRow: TicketRow = {
	issueId: ISSUE,
	provider: "jira",
	externalKey: "APP-12",
	externalUrl: "https://acme.atlassian.net/browse/APP-12",
	createdBy: "u1",
	createdAt: new Date("2026-10-10T10:00:00.000Z"),
};

class FakeJira extends JiraClient {
	verify = vi.fn(async () => {});
	createIssue = vi.fn(async () => ({
		key: "APP-12",
		url: "https://acme.atlassian.net/browse/APP-12",
	}));
}

function setup(
	over: {
		role?: "member" | "admin" | "none";
		repo?: Partial<IntegrationsRepository>;
	} = {},
) {
	const role = over.role ?? "admin";
	const access = {
		assert: vi.fn(async (_u: string, _o: string, level: string) => {
			if (role === "none" || (level === "admin" && role === "member"))
				throw new ForbiddenException();
		}),
	};
	const projects = { ensureExists: vi.fn(async () => {}) };
	const activity = { record: vi.fn(async () => {}) };
	const jira = new FakeJira();
	const upsertJira = vi.fn(async (_p: string, v: Record<string, string>) =>
		connection({
			siteUrl: v.siteUrl,
			email: v.email,
			apiTokenEncrypted: v.apiTokenEncrypted,
			jiraProjectKey: v.jiraProjectKey,
			issueType: v.issueType,
		}),
	);
	const repo = {
		getJira: vi.fn(async () => undefined),
		upsertJira,
		deleteJira: vi.fn(async () => true),
		issueForTicket: vi.fn(async () => ({
			issue: {
				title: "TypeError: boom",
				culprit: "x (a.ts:1)",
				level: "error",
				eventCount: 3,
				firstSeen: new Date(),
				lastSeen: new Date(),
				lastRelease: "1.0.0",
			},
			projectSlug: "app",
			orgSlug: "acme",
		})),
		ticketOf: vi.fn(async () => undefined),
		insertTicket: vi.fn(async () => ticketRow),
		deleteTicket: vi.fn(async () => ticketRow),
		person: vi.fn(async () => ({
			id: "u1",
			name: "Ana",
			email: "ana@acme.test",
		})),
		...over.repo,
	};
	const config = {
		get: (key: string) =>
			key === "BETTER_AUTH_SECRET" ? SECRET : "http://web.test/",
	};
	const service = new IntegrationsService(
		repo as unknown as IntegrationsRepository,
		jira,
		access as unknown as OrgAccessService,
		projects as unknown as ProjectsService,
		activity as unknown as ActivityService,
		config as unknown as ConfigService<never, true>,
	);
	return { service, repo, jira, activity, access, upsertJira };
}

describe("IntegrationsService.getJira", () => {
	it("sin conexión dice que no está conectado", async () => {
		const { service } = setup({ role: "member" });
		expect(await service.getJira("u1", "org", PROJECT)).toMatchObject({
			connected: false,
		});
	});

	it("nunca devuelve el token", async () => {
		const { service } = setup({
			role: "member",
			repo: { getJira: vi.fn(async () => connection()) },
		});
		const dto = await service.getJira("u1", "org", PROJECT);
		expect(dto).toEqual({
			connected: true,
			siteUrl: input.siteUrl,
			email: input.email,
			projectKey: "APP",
			issueType: "Bug",
		});
		expect(JSON.stringify(dto)).not.toContain("tok-1");
	});
});

describe("IntegrationsService.connectJira", () => {
	it("verifica contra Jira y guarda el token cifrado", async () => {
		const { service, upsertJira, jira } = setup();
		await service.connectJira("u1", "org", PROJECT, input);
		expect(jira.verify).toHaveBeenCalledWith(
			{ siteUrl: input.siteUrl, email: input.email, apiToken: "tok-1" },
			"APP",
			"Bug",
		);
		const saved = upsertJira.mock.calls[0][1];
		expect(saved.apiTokenEncrypted).not.toContain("tok-1");
		expect(box.decrypt(saved.apiTokenEncrypted)).toBe("tok-1");
	});

	it("solo owner/admin pueden conectar", async () => {
		const { service, jira } = setup({ role: "member" });
		await expect(
			service.connectJira("u1", "org", PROJECT, input),
		).rejects.toBeInstanceOf(ForbiddenException);
		expect(jira.verify).not.toHaveBeenCalled();
	});

	it("no guarda nada si Jira rechaza las credenciales", async () => {
		const { service, upsertJira, jira } = setup();
		jira.verify.mockRejectedValueOnce(new JiraError("JIRA_AUTH_FAILED"));
		await expect(
			service.connectJira("u1", "org", PROJECT, input),
		).rejects.toBeInstanceOf(BadRequestException);
		expect(upsertJira).not.toHaveBeenCalled();
	});

	it("un fallo de red con Jira es un 502, no un 400", async () => {
		const { service, jira } = setup();
		jira.verify.mockRejectedValueOnce(
			new JiraError("JIRA_REQUEST_FAILED", "timeout"),
		);
		await expect(
			service.connectJira("u1", "org", PROJECT, input),
		).rejects.toBeInstanceOf(BadGatewayException);
	});

	it("sin token la primera vez se exige", async () => {
		const { service } = setup();
		await expect(
			service.connectJira("u1", "org", PROJECT, {
				...input,
				apiToken: undefined,
			}),
		).rejects.toMatchObject({ response: { reason: "JIRA_TOKEN_REQUIRED" } });
	});

	it("al editar sin token se reutiliza el guardado", async () => {
		const { service, upsertJira, jira } = setup({
			repo: { getJira: vi.fn(async () => connection()) },
		});
		await service.connectJira("u1", "org", PROJECT, {
			...input,
			apiToken: undefined,
			projectKey: "OPS",
		});
		expect(jira.verify).toHaveBeenCalledWith(
			expect.objectContaining({ apiToken: "tok-1" }),
			"OPS",
			"Bug",
		);
		const saved = upsertJira.mock.calls[0][1];
		expect(box.decrypt(saved.apiTokenEncrypted)).toBe("tok-1");
	});

	it("no reutiliza el token guardado con otro sitio u otro correo (no se envía a donde no toca)", async () => {
		const { service, jira } = setup({
			repo: { getJira: vi.fn(async () => connection()) },
		});
		for (const change of [
			{ siteUrl: "https://evil.atlassian.net" },
			{ email: "otra@acme.test" },
		]) {
			await expect(
				service.connectJira("u1", "org", PROJECT, {
					...input,
					apiToken: undefined,
					...change,
				}),
			).rejects.toMatchObject({ response: { reason: "JIRA_TOKEN_REQUIRED" } });
		}
		expect(jira.verify).not.toHaveBeenCalled();
	});
});

describe("IntegrationsService.disconnectJira", () => {
	it("desconecta; si no había conexión, 404", async () => {
		const ok = setup();
		await expect(
			ok.service.disconnectJira("u1", "org", PROJECT),
		).resolves.toBeUndefined();
		const none = setup({ repo: { deleteJira: vi.fn(async () => false) } });
		await expect(
			none.service.disconnectJira("u1", "org", PROJECT),
		).rejects.toBeInstanceOf(NotFoundException);
	});
});

describe("IntegrationsService.createTicket", () => {
	const connected = { getJira: vi.fn(async () => connection()) };

	it("crea el ticket con el título y el enlace al issue, lo liga y lo anota en la actividad", async () => {
		const { service, jira, repo, activity } = setup({
			role: "member",
			repo: connected,
		});
		const ticket = await service.createTicket("u1", "org", PROJECT, ISSUE);
		const sent = jira.createIssue.mock.calls[0] as unknown as [
			unknown,
			{ summary: string; projectKey: string; description: unknown },
		];
		expect(sent[1]).toMatchObject({
			summary: "TypeError: boom",
			projectKey: "APP",
		});
		expect(JSON.stringify(sent[1].description)).toContain(
			`http://web.test/acme/projects/app/issues/${ISSUE}`,
		);
		expect(repo.insertTicket).toHaveBeenCalledWith({
			issueId: ISSUE,
			externalKey: "APP-12",
			externalUrl: "https://acme.atlassian.net/browse/APP-12",
			createdBy: "u1",
		});
		expect(activity.record).toHaveBeenCalledWith(ISSUE, "u1", "ticket", {
			action: "created",
			key: "APP-12",
			url: "https://acme.atlassian.net/browse/APP-12",
		});
		expect(ticket).toMatchObject({
			provider: "jira",
			key: "APP-12",
			createdBy: { name: "Ana" },
		});
	});

	it("sin conexión es un 400", async () => {
		const { service } = setup({ role: "member" });
		await expect(
			service.createTicket("u1", "org", PROJECT, ISSUE),
		).rejects.toMatchObject({ response: { reason: "JIRA_NOT_CONNECTED" } });
	});

	it("un issue inexistente es 404, y uno que ya tiene ticket es 409 sin llamar a Jira", async () => {
		const missing = setup({
			repo: { ...connected, issueForTicket: vi.fn(async () => undefined) },
		});
		await expect(
			missing.service.createTicket("u1", "org", PROJECT, ISSUE),
		).rejects.toBeInstanceOf(NotFoundException);

		const linked = setup({
			repo: { ...connected, ticketOf: vi.fn(async () => ticketRow) },
		});
		await expect(
			linked.service.createTicket("u1", "org", PROJECT, ISSUE),
		).rejects.toBeInstanceOf(ConflictException);
		expect(linked.jira.createIssue).not.toHaveBeenCalled();
	});

	it("si otra petición ligó un ticket mientras tanto, 409", async () => {
		const { service } = setup({
			repo: { ...connected, insertTicket: vi.fn(async () => undefined) },
		});
		await expect(
			service.createTicket("u1", "org", PROJECT, ISSUE),
		).rejects.toBeInstanceOf(ConflictException);
	});

	it("si el secreto del servidor cambió y el token no se puede leer, pide reconectar (400)", async () => {
		const { service, jira } = setup({
			repo: {
				getJira: vi.fn(async () =>
					connection({
						apiTokenEncrypted: new SecretBox(
							"otro-secreto-0123456789-abcdefgh",
						).encrypt("x"),
					}),
				),
			},
		});
		await expect(
			service.createTicket("u1", "org", PROJECT, ISSUE),
		).rejects.toMatchObject({ response: { reason: "JIRA_AUTH_FAILED" } });
		expect(jira.createIssue).not.toHaveBeenCalled();
	});

	it("si Jira falla no se liga nada", async () => {
		const { service, jira, repo } = setup({ repo: connected });
		jira.createIssue.mockRejectedValueOnce(
			new JiraError("JIRA_REQUEST_FAILED"),
		);
		await expect(
			service.createTicket("u1", "org", PROJECT, ISSUE),
		).rejects.toBeInstanceOf(BadGatewayException);
		expect(repo.insertTicket).not.toHaveBeenCalled();
	});
});

describe("IntegrationsService.unlinkTicket", () => {
	it("quita el vínculo y lo anota; sin ticket, 404", async () => {
		const ok = setup({ role: "member" });
		await ok.service.unlinkTicket("u1", "org", PROJECT, ISSUE);
		expect(ok.activity.record).toHaveBeenCalledWith(
			ISSUE,
			"u1",
			"ticket",
			expect.objectContaining({ action: "unlinked", key: "APP-12" }),
		);

		const none = setup({
			repo: { deleteTicket: vi.fn(async () => undefined) },
		});
		await expect(
			none.service.unlinkTicket("u1", "org", PROJECT, ISSUE),
		).rejects.toMatchObject({ response: { reason: "TICKET_NOT_FOUND" } });
	});
});
