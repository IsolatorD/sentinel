import { preferencesDtoSchema } from "@sentinel/shared";
import { describe, expect, it } from "vitest";
import { scalar } from "../support/db.js";
import { eventually } from "../support/eventually.js";
import {
	createTenant,
	errorEvent,
	type Session,
	type Tenant,
} from "../support/factories.js";
import { mails } from "../support/mailbox.js";

const es = { headers: { "Accept-Language": "es-AR,es;q=0.9,en;q=0.5" } };
const en = { headers: { "Accept-Language": "en-US,en;q=0.9" } };

const notice = (res: { headers: Headers }) => ({
	text: res.headers.get("x-sentinel-message")
		? decodeURIComponent(res.headers.get("x-sentinel-message") as string)
		: null,
	code: res.headers.get("x-sentinel-message-code"),
});

async function setLocale(t: Tenant, session: Session, locale: "en" | "es") {
	const res = await t.client.patch("/api/me/preferences", { locale }, session);
	expect(res.status, res.text).toBe(200);
}

const uid = async (t: Tenant, session: Session) =>
	(await t.client.get("/api/auth/get-session", session)).json.user.id as string;

async function withIssue() {
	const t = await createTenant();
	await t.client.ingest(t.projectId, t.key, errorEvent({ type: "I18nError" }));
	await eventually(async () =>
		expect(
			await scalar("select count(*) from issue where project_id = $1", [
				t.projectId,
			]),
		).toBe(1),
	);
	const list = (
		await t.client.get(`${t.projectPath}/issues?status=all`, t.owner)
	).json;
	return {
		t,
		issueId: list.items[0].id as string,
		path: `${t.projectPath}/issues/${list.items[0].id}`,
	};
}

describe("errores traducidos", () => {
	it("el mensaje sale en el idioma de la petición; el código no cambia", async () => {
		const t = await createTenant();
		const missing = `${t.projectPath}/issues/00000000-0000-4000-8000-000000000000`;

		const spanish = await t.client.get(missing, t.owner, es);
		expect(spanish.status).toBe(404);
		expect(spanish.json).toMatchObject({
			code: "NOT_FOUND",
			reason: "ISSUE_NOT_FOUND",
			message: "No se encontró el issue",
		});

		const english = await t.client.get(missing, t.owner, en);
		expect(english.json).toMatchObject({
			code: "NOT_FOUND",
			reason: "ISSUE_NOT_FOUND",
			message: "Issue not found",
		});
	});

	it("sin cabecera o con un idioma no soportado, usa el inglés", async () => {
		const t = await createTenant();
		const missing = `${t.projectPath}/issues/00000000-0000-4000-8000-000000000000`;
		for (const extra of [
			{},
			{ headers: { "Accept-Language": "fr-FR,fr;q=0.9" } },
			{ headers: { "Accept-Language": "basura;;;" } },
		]) {
			expect((await t.client.get(missing, t.owner, extra)).json.message).toBe(
				"Issue not found",
			);
		}
	});

	it("los errores de autenticación y permisos también se traducen", async () => {
		const t = await createTenant();
		const member = await t.client.signUp("member");
		await t.client.addMember(t.owner, t.orgId, member, "member");
		const outsider = await t.client.signUp("outsider");

		expect(
			(await t.client.get(`${t.projectPath}/issues`, undefined, es)).json
				.message,
		).toBe("No autorizado");
		expect(
			(
				await t.client.post(
					`${t.projectPath}/alerts/channels`,
					{ type: "email", name: "x", recipients: { mode: "all" } },
					member,
					es,
				)
			).json.message,
		).toBe("No tienes permisos suficientes");
		expect(
			(await t.client.get(`${t.projectPath}/issues`, outsider, es)).json
				.message,
		).toBe("No se encontró la organización");
	});

	it("la validación se redacta en el idioma de la petición, con el valor recibido", async () => {
		const t = await createTenant();
		const body = { name: 42 };
		const spanish = await t.client.post(
			`/api/organizations/${t.orgId}/projects`,
			body,
			t.owner,
			es,
		);
		expect(spanish.status).toBe(400);
		expect(spanish.json).toMatchObject({
			code: "VALIDATION_FAILED",
			reason: "VALIDATION_FAILED",
			message: "La validación falló",
		});
		expect(spanish.json.issues[0].path).toBe("name");
		expect(spanish.json.issues[0].message).toMatch(
			/se esperaba texto, recibido número/,
		);

		const english = await t.client.post(
			`/api/organizations/${t.orgId}/projects`,
			body,
			t.owner,
			en,
		);
		expect(english.json.message).toBe("Validation failed");
		expect(english.json.issues[0].message).toMatch(
			/expected string, received number/,
		);
	});

	it("los mensajes propios de nuestros esquemas también se traducen", async () => {
		const { t, path } = await withIssue();
		expect(
			(await t.client.patch(path, {}, t.owner, es)).json.issues[0].message,
		).toBe("No hay nada que actualizar");
		expect(
			(await t.client.patch(path, {}, t.owner, en)).json.issues[0].message,
		).toBe("Nothing to update");
		const channel = await t.client.post(
			`${t.projectPath}/alerts/channels`,
			{ type: "webhook", name: "x", url: "ftp://example.com" },
			t.owner,
			es,
		);
		expect(channel.json.issues[0].message).toBe(
			"La URL debe empezar por http:// o https://",
		);
	});

	it("un error de servicio con valores (asignar a quien no es miembro) y uno del cuerpo binario", async () => {
		const { t, path } = await withIssue();
		const stranger = await t.client.signUp("stranger");
		const res = await t.client.patch(
			path,
			{ assigneeId: await uid(t, stranger) },
			t.owner,
			es,
		);
		expect(res.status).toBe(400);
		expect(res.json.message).toBe(
			"La persona asignada no es miembro de la organización",
		);

		const upload = await t.client.putBinary(
			`${t.projectPath}/releases/1.0.0/artifacts?name=~/a.js`,
			"no es json",
			{ session: t.owner, headers: { "Accept-Language": "es" } },
		);
		expect(upload.json.message).toBe("El archivo no es un JSON válido");
	});

	it("un JSON roto y un error interno no filtran detalles", async () => {
		const t = await createTenant();
		const broken = await t.client.request(
			`/api/organizations/${t.orgId}/projects`,
			{
				method: "POST",
				rawBody: "{no",
				session: t.owner,
				headers: { "Accept-Language": "es" },
			},
		);
		expect(broken.status).toBe(400);
		expect(broken.json.message).toBe("El cuerpo no es un JSON válido");
	});
});

describe("avisos de éxito", () => {
	it("crear un proyecto avisa en el idioma de la petición, con su nombre", async () => {
		const t = await createTenant();
		const spanish = await t.client.post(
			`/api/organizations/${t.orgId}/projects`,
			{ name: "Tienda ñandú" },
			t.owner,
			es,
		);
		expect(spanish.status).toBe(201);
		expect(notice(spanish)).toEqual({
			text: "Proyecto «Tienda ñandú» creado",
			code: "NOTICE_PROJECT_CREATED",
		});

		const english = await t.client.post(
			`/api/organizations/${t.orgId}/projects`,
			{ name: "Shop" },
			t.owner,
			en,
		);
		expect(notice(english)).toEqual({
			text: "Project “Shop” created",
			code: "NOTICE_PROJECT_CREATED",
		});
	});

	it("el cuerpo de la respuesta no cambia: el aviso viaja solo en cabeceras", async () => {
		const t = await createTenant();
		const res = await t.client.post(
			`/api/organizations/${t.orgId}/projects`,
			{ name: "Solo cabeceras" },
			t.owner,
			es,
		);
		expect(Object.keys(res.json).sort()).toEqual(
			["createdAt", "id", "keys", "name", "organizationId", "platform", "slug"]
				.filter((k) => k in res.json)
				.sort(),
		);
		expect(res.json).not.toHaveProperty("message");
		expect(res.json).not.toHaveProperty("notice");
	});

	it("los cambios de un issue avisan según lo que hicieron", async () => {
		const { t, path } = await withIssue();
		const member = await t.client.signUp("ana");
		await t.client.addMember(t.owner, t.orgId, member, "member");
		const memberId = await uid(t, member);

		const cases: Array<[unknown, string, string]> = [
			[{ status: "ignored" }, "NOTICE_ISSUE_IGNORED", "Issue ignorado"],
			[{ status: "unresolved" }, "NOTICE_ISSUE_REOPENED", "Issue reabierto"],
			[{ status: "resolved" }, "NOTICE_ISSUE_RESOLVED", "Issue resuelto"],
			[
				{
					status: "resolved",
					resolution: { type: "release", release: "2.5.0" },
				},
				"NOTICE_ISSUE_RESOLVED_IN",
				"Issue resuelto en 2.5.0",
			],
			[
				{ status: "resolved", resolution: { type: "next_release" } },
				"NOTICE_ISSUE_RESOLVED_NEXT",
				"El issue se resolverá en la próxima release",
			],
			[
				{ assigneeId: memberId },
				"NOTICE_ISSUE_ASSIGNED",
				"Issue asignado a ana",
			],
			[{ assigneeId: null }, "NOTICE_ISSUE_UNASSIGNED", "Issue sin asignar"],
		];
		for (const [body, code, text] of cases) {
			const res = await t.client.patch(path, body, t.owner, es);
			expect(res.status, JSON.stringify(body)).toBe(200);
			expect(notice(res), JSON.stringify(body)).toEqual({ text, code });
		}
	});

	it("comentarios, canales, reglas y tokens también avisan", async () => {
		const { t, path } = await withIssue();
		const comment = await t.client.post(
			`${path}/comments`,
			{ body: "hola" },
			t.owner,
			es,
		);
		expect(notice(comment).code).toBe("NOTICE_COMMENT_ADDED");
		const edited = await t.client.patch(
			`${path}/comments/${comment.json.id}`,
			{ body: "chao" },
			t.owner,
			es,
		);
		expect(notice(edited).code).toBe("NOTICE_COMMENT_EDITED");
		expect(
			notice(
				await t.client.delete(
					`${path}/comments/${comment.json.id}`,
					t.owner,
					es,
				),
			).code,
		).toBe("NOTICE_COMMENT_DELETED");

		const channel = await t.client.post(
			`${t.projectPath}/alerts/channels`,
			{ type: "email", name: "Equipo", recipients: { mode: "all" } },
			t.owner,
			es,
		);
		expect(notice(channel)).toEqual({
			text: "Canal creado",
			code: "NOTICE_CHANNEL_CREATED",
		});
		const rule = await t.client.post(
			`${t.projectPath}/alerts/rules`,
			{ name: "r", trigger: "new_issue", channelIds: [channel.json.id] },
			t.owner,
			es,
		);
		expect(notice(rule).code).toBe("NOTICE_RULE_CREATED");
		expect(
			notice(
				await t.client.post(
					`${t.projectPath}/alerts/channels/${channel.json.id}/test`,
					{},
					t.owner,
					es,
				),
			).code,
		).toBe("NOTICE_CHANNEL_TEST_SENT");
		expect(
			notice(
				await t.client.delete(
					`${t.projectPath}/alerts/rules/${rule.json.id}`,
					t.owner,
					es,
				),
			).code,
		).toBe("NOTICE_RULE_DELETED");

		const token = await t.client.post(
			`/api/organizations/${t.orgId}/tokens`,
			{ name: "ci" },
			t.owner,
			en,
		);
		expect(notice(token)).toEqual({
			text: "API token created",
			code: "NOTICE_TOKEN_CREATED",
		});
		expect(
			notice(
				await t.client.delete(
					`/api/organizations/${t.orgId}/tokens/${token.json.id}`,
					t.owner,
					en,
				),
			).code,
		).toBe("NOTICE_TOKEN_REVOKED");
		expect(notice(await t.client.delete(path, t.owner, es)).code).toBe(
			"NOTICE_ISSUE_DELETED",
		);
	});

	it("lo que falla, lo que solo lee y lo que no cambió nada no avisan de éxito", async () => {
		const { t, path } = await withIssue();
		expect(notice(await t.client.get(path, t.owner, es)).code).toBeNull();
		expect(
			notice(await t.client.get(`${t.projectPath}/issues`, t.owner, es)).code,
		).toBeNull();
		const failed = await t.client.patch(path, {}, t.owner, es);
		expect(failed.status).toBe(400);
		expect(notice(failed).code).toBeNull();
		const forbidden = await t.client.post(
			`/api/organizations/${t.orgId}/projects`,
			{ name: "x" },
			undefined,
			es,
		);
		expect(notice(forbidden).code).toBeNull();
	});
});

describe("preferencias", () => {
	it("empiezan vacías y se guardan por separado, sin pisarse", async () => {
		const t = await createTenant();
		expect(
			preferencesDtoSchema.parse(
				(await t.client.get("/api/me/preferences", t.owner)).json,
			),
		).toEqual({ locale: null, theme: null, toursSeen: [] });

		await t.client.patch("/api/me/preferences", { locale: "es" }, t.owner);
		await t.client.patch("/api/me/preferences", { theme: "dark" }, t.owner);
		const both = preferencesDtoSchema.parse(
			(await t.client.get("/api/me/preferences", t.owner)).json,
		);
		expect(both).toEqual({ locale: "es", theme: "dark", toursSeen: [] });

		const tours = await t.client.patch(
			"/api/me/preferences",
			{ toursSeen: ["welcome", "issues", "welcome"] },
			t.owner,
		);
		expect(preferencesDtoSchema.parse(tours.json)).toEqual({
			locale: "es",
			theme: "dark",
			toursSeen: ["welcome", "issues"],
		});
		const reset = await t.client.patch(
			"/api/me/preferences",
			{ toursSeen: [] },
			t.owner,
		);
		expect(reset.json).toMatchObject({ locale: "es", toursSeen: [] });
	});

	it("rechaza valores inválidos y peticiones vacías, traducidos", async () => {
		const t = await createTenant();
		for (const body of [
			{ locale: "fr" },
			{ theme: "violeta" },
			{ toursSeen: ["inventado"] },
			{ toursSeen: "welcome" },
			{},
		]) {
			expect(
				(await t.client.patch("/api/me/preferences", body, t.owner)).status,
				JSON.stringify(body),
			).toBe(400);
		}
		expect(
			(await t.client.patch("/api/me/preferences", {}, t.owner, es)).json
				.issues[0].message,
		).toBe("No hay nada que actualizar");
	});

	it("son de cada persona y exigen sesión", async () => {
		const t = await createTenant();
		const other = await t.client.signUp("otra");
		await t.client.patch("/api/me/preferences", { locale: "es" }, t.owner);
		expect(
			(await t.client.get("/api/me/preferences", other)).json.locale,
		).toBeNull();
		expect((await t.client.get("/api/me/preferences")).status).toBe(401);
		expect(
			(await t.client.patch("/api/me/preferences", { locale: "es" })).status,
		).toBe(401);
	});
});

describe("correos en el idioma de cada persona", () => {
	const mailTo = (email: string) => mails().filter((m) => m.to.includes(email));

	it("la invitación sale en el idioma de quien invita si el invitado no tiene cuenta", async () => {
		const t = await createTenant();
		await setLocale(t, t.owner, "es");
		const email = `nuevo-${crypto.randomUUID().slice(0, 8)}@e2e.test`;
		await t.client.post(
			"/api/auth/organization/invite-member",
			{ email, role: "member", organizationId: t.orgId },
			t.owner,
		);
		await eventually(async () => expect(mailTo(email)).toHaveLength(1));
		const [mail] = mailTo(email);
		expect(mail.subject).toBe("owner te invitó a Acme en Sentinel");
		expect(mail.text).toContain("como miembro");
		expect(mail.text).toContain("Aceptar la invitación");
	});

	it("si el invitado ya tiene cuenta, manda su idioma, no el de quien invita", async () => {
		const t = await createTenant();
		await setLocale(t, t.owner, "es");
		const guest = await t.client.signUp("guest");
		await setLocale(t, guest, "en");
		await t.client.post(
			"/api/auth/organization/invite-member",
			{ email: guest.email, role: "member", organizationId: t.orgId },
			t.owner,
		);
		await eventually(async () => expect(mailTo(guest.email)).toHaveLength(1));
		expect(mailTo(guest.email)[0].subject).toBe(
			"owner invited you to Acme on Sentinel",
		);
	});

	it("sin idioma guardado, usa el del navegador de quien invita", async () => {
		const t = await createTenant();
		const email = `navegador-${crypto.randomUUID().slice(0, 8)}@e2e.test`;
		await t.client.request("/api/auth/organization/invite-member", {
			method: "POST",
			body: { email, role: "member", organizationId: t.orgId },
			session: t.owner,
			headers: { "Accept-Language": "es-ES,es;q=0.9" },
		});
		await eventually(async () => expect(mailTo(email)).toHaveLength(1));
		expect(mailTo(email)[0].subject).toMatch(/te invitó a/);
	});

	it("una alerta llega a cada miembro en su propio idioma", async () => {
		const t = await createTenant();
		const spanish = await t.client.signUp("hispano");
		await t.client.addMember(t.owner, t.orgId, spanish, "member");
		await setLocale(t, spanish, "es");
		await setLocale(t, t.owner, "en");
		const channel = await t.client.post(
			`${t.projectPath}/alerts/channels`,
			{ type: "email", name: "Todos", recipients: { mode: "all" } },
			t.owner,
		);
		await t.client.post(
			`${t.projectPath}/alerts/rules`,
			{
				name: "Nuevos",
				trigger: "new_issue",
				cooldownMinutes: 0,
				channelIds: [channel.json.id],
			},
			t.owner,
		);

		await t.client.ingest(
			t.projectId,
			t.key,
			errorEvent({ type: "BilingueError" }),
		);
		await eventually(async () =>
			expect(
				mails().filter((m) => m.subject.includes("BilingueError")),
			).toHaveLength(2),
		);
		const received = mails().filter((m) => m.subject.includes("BilingueError"));
		const forSpanish = received.find((m) => m.to.includes(spanish.email));
		const forOwner = received.find((m) => m.to.includes(t.owner.email));
		expect(forSpanish?.subject).toMatch(/Issue nuevo/);
		expect(forSpanish?.text).toContain("Ver el issue");
		expect(forOwner?.subject).toMatch(/New issue/);
		expect(forOwner?.text).toContain("View the issue");
	});
});
