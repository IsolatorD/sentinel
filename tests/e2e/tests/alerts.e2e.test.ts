import { createHmac } from "node:crypto";
import {
	channelDtoSchema,
	createdChannelDtoSchema,
	deliveryListDtoSchema,
	ruleDtoSchema,
} from "@sentinel/shared";
import { afterEach, describe, expect, it } from "vitest";
import { scalar } from "../support/db.js";
import { eventually } from "../support/eventually.js";
import { createTenant, errorEvent, type Tenant } from "../support/factories.js";
import { mails } from "../support/mailbox.js";
import { type Receiver, startReceiver } from "../support/receiver.js";

const receivers: Receiver[] = [];
afterEach(async () => {
	await Promise.all(receivers.splice(0).map((r) => r.close()));
});
async function receiver(): Promise<Receiver> {
	const r = await startReceiver();
	receivers.push(r);
	return r;
}

const alerts = (t: Tenant) => `${t.projectPath}/alerts`;
const issueCount = (t: Tenant) =>
	scalar("select count(*) from issue where project_id = $1", [t.projectId]);

async function createChannel(t: Tenant, body: unknown) {
	const res = await t.client.post(`${alerts(t)}/channels`, body, t.owner);
	expect(res.status, res.text).toBe(201);
	return createdChannelDtoSchema.parse(res.json);
}
const webhookChannel = (t: Tenant, url: string, name = "Ops webhook") =>
	createChannel(t, { type: "webhook", name, url });

async function createRule(t: Tenant, body: Record<string, unknown>) {
	const res = await t.client.post(
		`${alerts(t)}/rules`,
		{ cooldownMinutes: 0, ...body },
		t.owner,
	);
	expect(res.status, res.text).toBe(201);
	return ruleDtoSchema.parse(res.json);
}

async function deliveries(t: Tenant) {
	const res = await t.client.get(`${alerts(t)}/deliveries?limit=100`, t.owner);
	expect(res.status).toBe(200);
	return deliveryListDtoSchema.parse(res.json);
}

async function ingest(t: Tenant, event: unknown) {
	const res = await t.client.ingest(t.projectId, t.key, event);
	expect(res.status).toBe(202);
}

/** Espera a que el worker guarde N issues (así se sabe que procesó los eventos anteriores). */
const settle = (t: Tenant, issues: number) =>
	eventually(async () => expect(await issueCount(t)).toBe(issues));

describe("canales", () => {
	it("un webhook devuelve su secreto una sola vez y la URL siempre enmascarada", async () => {
		const t = await createTenant();
		const url = "http://127.0.0.1:9/services/T000/B000/superSecretToken1234";
		const created = await webhookChannel(t, url);
		expect(created.signingSecret).toMatch(/^whsec_[0-9a-f]{48}$/);
		expect(created.maskedUrl).toBe("http://127.0.0.1:9/…1234");

		const list = await t.client.get(`${alerts(t)}/channels`, t.owner);
		expect(list.status).toBe(200);
		expect(list.text).not.toContain(created.signingSecret);
		expect(list.text).not.toContain("superSecretToken");
		expect(channelDtoSchema.parse(list.json[0])).toMatchObject({
			name: "Ops webhook",
			type: "webhook",
			enabled: true,
		});
	});

	it("Slack y email no tienen secreto de firma", async () => {
		const t = await createTenant();
		const slack = await createChannel(t, {
			type: "slack",
			name: "Slack",
			url: "http://127.0.0.1:9/slack/abcdefgh",
		});
		const email = await createChannel(t, {
			type: "email",
			name: "Equipo",
			recipients: { mode: "all" },
		});
		expect(slack.signingSecret).toBeNull();
		expect(email.signingSecret).toBeNull();
		expect(email.recipients).toEqual({ mode: "all" });
	});

	it("valida la URL, el nombre y los destinatarios", async () => {
		const t = await createTenant();
		const post = (body: unknown) =>
			t.client.post(`${alerts(t)}/channels`, body, t.owner);
		for (const url of [
			"no es url",
			"ftp://example.com/x",
			"https://user:pass@example.com/x",
			"",
		]) {
			expect(
				(await post({ type: "webhook", name: "x", url })).status,
				url,
			).toBe(400);
		}
		expect(
			(
				await post({
					type: "webhook",
					name: "  ",
					url: "https://example.com/h",
				})
			).status,
		).toBe(400);
		expect((await post({ type: "otro", name: "x" })).status).toBe(400);
		expect(
			(
				await post({
					type: "email",
					name: "x",
					recipients: { mode: "members", userIds: [] },
				})
			).status,
		).toBe(400);
		// Un usuario que no es de la organización no puede ser destinatario.
		const stranger = await t.client.signUp("stranger");
		const me = await t.client.get("/api/auth/get-session", stranger);
		const res = await post({
			type: "email",
			name: "x",
			recipients: { mode: "members", userIds: [me.json.user.id] },
		});
		expect(res.status).toBe(400);
	});

	it("cualquier miembro ve los canales, solo owner/admin los gestionan, y los ajenos no ven nada", async () => {
		const t = await createTenant();
		const channel = await webhookChannel(t, "http://127.0.0.1:9/hook");
		const member = await t.client.signUp("member");
		await t.client.addMember(t.owner, t.orgId, member, "member");
		const outsider = await t.client.signUp("outsider");
		const path = `${alerts(t)}/channels`;

		expect((await t.client.get(path, member)).status).toBe(200);
		expect(
			(
				await t.client.post(
					path,
					{ type: "email", name: "x", recipients: { mode: "all" } },
					member,
				)
			).status,
		).toBe(403);
		expect(
			(await t.client.patch(`${path}/${channel.id}`, { name: "nuevo" }, member))
				.status,
		).toBe(403);
		expect(
			(await t.client.delete(`${path}/${channel.id}`, member)).status,
		).toBe(403);
		expect(
			(await t.client.post(`${path}/${channel.id}/test`, {}, member)).status,
		).toBe(403);
		expect((await t.client.get(path, outsider)).status).toBe(404);
		expect((await t.client.get(path)).status).toBe(401);
	});

	it("se pueden renombrar, desactivar y borrar; un id de otro proyecto da 404", async () => {
		const t = await createTenant();
		const other = await createTenant();
		const channel = await createChannel(t, {
			type: "email",
			name: "Equipo",
			recipients: { mode: "all" },
		});
		const path = `${alerts(t)}/channels/${channel.id}`;

		const patched = await t.client.patch(
			path,
			{ name: "Guardia", enabled: false },
			t.owner,
		);
		expect(channelDtoSchema.parse(patched.json)).toMatchObject({
			name: "Guardia",
			enabled: false,
		});
		expect(
			(await t.client.patch(path, { url: "https://example.com/x" }, t.owner))
				.status,
		).toBe(400); // email no tiene URL
		expect((await t.client.patch(path, {}, t.owner)).status).toBe(400);
		expect(
			(
				await other.client.patch(
					`${alerts(other)}/channels/${channel.id}`,
					{ name: "x" },
					other.owner,
				)
			).status,
		).toBe(404);

		expect((await t.client.delete(path, t.owner)).status).toBe(204);
		expect((await t.client.delete(path, t.owner)).status).toBe(404);
	});
});

describe("reglas", () => {
	it("se crean con sus canales y se listan", async () => {
		const t = await createTenant();
		const channel = await webhookChannel(t, "http://127.0.0.1:9/hook");
		const rule = await createRule(t, {
			name: "Nuevos",
			trigger: "new_issue",
			channelIds: [channel.id],
			environment: "production",
			minLevel: "error",
		});
		expect(rule).toMatchObject({
			trigger: "new_issue",
			environment: "production",
			minLevel: "error",
			channelIds: [channel.id],
			enabled: true,
			threshold: null,
		});
		const list = await t.client.get(`${alerts(t)}/rules`, t.owner);
		expect(list.json).toHaveLength(1);
	});

	it("la regla de frecuencia exige umbral y ventana, y las demás los rechazan", async () => {
		const t = await createTenant();
		const channel = await webhookChannel(t, "http://127.0.0.1:9/hook");
		const post = (body: Record<string, unknown>) =>
			t.client.post(
				`${alerts(t)}/rules`,
				{ name: "r", channelIds: [channel.id], ...body },
				t.owner,
			);
		expect((await post({ trigger: "frequency" })).status).toBe(400);
		expect((await post({ trigger: "frequency", threshold: 5 })).status).toBe(
			400,
		);
		expect(
			(await post({ trigger: "frequency", threshold: 0, windowMinutes: 5 }))
				.status,
		).toBe(400);
		expect(
			(await post({ trigger: "frequency", threshold: 5, windowMinutes: 2000 }))
				.status,
		).toBe(400);
		expect(
			(await post({ trigger: "new_issue", threshold: 5, windowMinutes: 5 }))
				.status,
		).toBe(400);
		expect(
			(await post({ trigger: "frequency", threshold: 5, windowMinutes: 10 }))
				.status,
		).toBe(201);
		expect((await post({ trigger: "new_issue", channelIds: [] })).status).toBe(
			400,
		);
	});

	it("solo acepta canales del propio proyecto", async () => {
		const t = await createTenant();
		const other = await createTenant();
		const foreign = await webhookChannel(other, "http://127.0.0.1:9/hook");
		const res = await t.client.post(
			`${alerts(t)}/rules`,
			{ name: "r", trigger: "new_issue", channelIds: [foreign.id] },
			t.owner,
		);
		expect(res.status).toBe(400);
	});

	it("editar no puede dejar una regla de frecuencia sin umbral; cambiar a otro disparador limpia el umbral", async () => {
		const t = await createTenant();
		const channel = await webhookChannel(t, "http://127.0.0.1:9/hook");
		const rule = await createRule(t, {
			name: "f",
			trigger: "frequency",
			threshold: 5,
			windowMinutes: 10,
			channelIds: [channel.id],
		});
		const path = `${alerts(t)}/rules/${rule.id}`;

		expect(
			(await t.client.patch(path, { threshold: null }, t.owner)).status,
		).toBe(400);
		const patched = await t.client.patch(
			path,
			{ threshold: 8, enabled: false },
			t.owner,
		);
		expect(ruleDtoSchema.parse(patched.json)).toMatchObject({
			threshold: 8,
			enabled: false,
		});
		const changed = await t.client.patch(
			path,
			{ trigger: "regression" },
			t.owner,
		);
		expect(ruleDtoSchema.parse(changed.json)).toMatchObject({
			trigger: "regression",
			threshold: null,
			windowMinutes: null,
		});
		expect((await t.client.delete(path, t.owner)).status).toBe(204);
		expect((await t.client.delete(path, t.owner)).status).toBe(404);
	});

	it("solo owner/admin gestionan reglas", async () => {
		const t = await createTenant();
		const channel = await webhookChannel(t, "http://127.0.0.1:9/hook");
		const member = await t.client.signUp("member");
		await t.client.addMember(t.owner, t.orgId, member, "member");
		const body = { name: "r", trigger: "new_issue", channelIds: [channel.id] };
		expect(
			(await t.client.post(`${alerts(t)}/rules`, body, member)).status,
		).toBe(403);
		expect((await t.client.get(`${alerts(t)}/rules`, member)).status).toBe(200);
	});
});

describe("avisos por webhook", () => {
	it("issue nuevo: llega firmado, una vez por issue, con el contenido esperado", async () => {
		const t = await createTenant();
		const target = await receiver();
		const channel = await webhookChannel(t, target.url);
		await createRule(t, {
			name: "Nuevos errores",
			trigger: "new_issue",
			channelIds: [channel.id],
		});

		await ingest(t, errorEvent({ type: "PaymentError", release: "2.4.0" }));
		await eventually(async () => expect(target.requests).toHaveLength(1));
		const [request] = target.requests;

		expect(request.method).toBe("POST");
		expect(request.headers["content-type"]).toBe("application/json");
		expect(request.headers["x-sentinel-event"]).toBe("issue.new");
		expect(request.json).toMatchObject({
			event: "issue.new",
			rule: { name: "Nuevos errores", trigger: "new_issue" },
			project: { id: t.projectId },
			issue: {
				type: "PaymentError",
				level: "error",
				release: "2.4.0",
				eventCount: 1,
			},
		});
		expect(request.json.url).toMatch(
			/^http:\/\/localhost:5173\/[^/]+\/projects\/[^/]+\/issues\/[0-9a-f-]{36}$/,
		);

		// Firma HMAC-SHA256 de "<timestamp>.<cuerpo>" con el secreto entregado al crear el canal.
		const timestamp = request.headers["x-sentinel-timestamp"] as string;
		const expected = `sha256=${createHmac(
			"sha256",
			channel.signingSecret as string,
		)
			.update(`${timestamp}.${request.raw}`)
			.digest("hex")}`;
		expect(request.headers["x-sentinel-signature"]).toBe(expected);
		expect(request.headers["x-sentinel-delivery"]).toBe(
			request.json.delivery_id,
		);
		expect(Math.abs(Number(timestamp) - Date.now() / 1000)).toBeLessThan(30);

		// Otro evento del mismo issue no avisa; un issue distinto sí.
		await ingest(t, errorEvent({ type: "PaymentError", release: "2.4.0" }));
		await ingest(t, errorEvent({ type: "OtherError" }));
		await eventually(async () => expect(target.requests).toHaveLength(2));
		await settle(t, 2);
		await new Promise((r) => setTimeout(r, 500));
		expect(target.requests).toHaveLength(2);
		expect(target.requests[1].json.issue.type).toBe("OtherError");

		const history = await deliveries(t);
		expect(history.total).toBe(2);
		expect(history.items[0]).toMatchObject({
			kind: "alert",
			status: "sent",
			statusCode: 200,
			attempts: 1,
			channelName: "Ops webhook",
			channelType: "webhook",
			ruleName: "Nuevos errores",
			error: null,
		});
		expect(history.items[0].sentAt).not.toBeNull();
	});

	it("regresión: avisa cuando un issue resuelto reaparece en una release posterior", async () => {
		const t = await createTenant();
		const target = await receiver();
		const channel = await webhookChannel(t, target.url);
		await createRule(t, {
			name: "Regresiones",
			trigger: "regression",
			channelIds: [channel.id],
		});

		await ingest(t, errorEvent({ release: "2.4.0" }));
		await settle(t, 1);
		const issues = (
			await t.client.get(`${t.projectPath}/issues?status=all`, t.owner)
		).json;
		await t.client.patch(
			`${t.projectPath}/issues/${issues.items[0].id}`,
			{ status: "resolved", resolution: { type: "next_release" } },
			t.owner,
		);

		// Una versión vieja no reabre: sin aviso.
		await ingest(t, errorEvent({ release: "2.3.0" }));
		await eventually(async () =>
			expect(
				await scalar("select count(*) from event where project_id = $1", [
					t.projectId,
				]),
			).toBe(2),
		);
		await new Promise((r) => setTimeout(r, 400));
		expect(target.requests).toHaveLength(0);

		await ingest(t, errorEvent({ release: "2.5.0" }));
		await eventually(async () => expect(target.requests).toHaveLength(1));
		expect(target.requests[0].json).toMatchObject({
			event: "issue.regression",
			issue: { regressedInRelease: "2.5.0", release: "2.5.0" },
		});
	});

	it("frecuencia: avisa al llegar al umbral y respeta el período de espera", async () => {
		const t = await createTenant();
		const target = await receiver();
		const channel = await webhookChannel(t, target.url);
		await createRule(t, {
			name: "Picos",
			trigger: "frequency",
			threshold: 3,
			windowMinutes: 60,
			cooldownMinutes: 60,
			channelIds: [channel.id],
		});
		const count = () =>
			scalar("select count(*) from event where project_id = $1", [t.projectId]);

		for (let i = 1; i <= 2; i++) {
			await ingest(t, errorEvent({ type: "Spike" }));
			await eventually(async () => expect(await count()).toBe(i));
		}
		await new Promise((r) => setTimeout(r, 400));
		expect(target.requests).toHaveLength(0);

		await ingest(t, errorEvent({ type: "Spike" }));
		await eventually(async () => expect(target.requests).toHaveLength(1));
		expect(target.requests[0].json).toMatchObject({
			event: "issue.frequency",
			frequency: { count: 3, windowMinutes: 60 },
		});

		// Seguir superando el umbral dentro del período de espera no repite el aviso.
		for (let i = 4; i <= 5; i++) {
			await ingest(t, errorEvent({ type: "Spike" }));
			await eventually(async () => expect(await count()).toBe(i));
		}
		await new Promise((r) => setTimeout(r, 500));
		expect(target.requests).toHaveLength(1);
	});

	it("sin período de espera, cada evento sobre el umbral vuelve a avisar", async () => {
		const t = await createTenant();
		const target = await receiver();
		const channel = await webhookChannel(t, target.url);
		await createRule(t, {
			name: "Cada uno",
			trigger: "frequency",
			threshold: 1,
			windowMinutes: 5,
			cooldownMinutes: 0,
			channelIds: [channel.id],
		});
		for (let i = 1; i <= 3; i++) {
			await ingest(t, errorEvent({ type: "Loud" }));
			await eventually(async () => expect(target.requests).toHaveLength(i));
		}
	});

	it("los filtros de entorno y nivel descartan lo que no corresponde", async () => {
		const t = await createTenant();
		const target = await receiver();
		const channel = await webhookChannel(t, target.url);
		await createRule(t, {
			name: "Producción grave",
			trigger: "new_issue",
			environment: "production",
			minLevel: "error",
			channelIds: [channel.id],
		});

		await ingest(
			t,
			errorEvent({ type: "StagingError", environment: "staging" }),
		);
		await ingest(t, {
			...errorEvent({ type: "WarnError", environment: "production" }),
			level: "warning",
		});
		await settle(t, 2);
		await new Promise((r) => setTimeout(r, 400));
		expect(target.requests).toHaveLength(0);

		await ingest(
			t,
			errorEvent({ type: "ProdError", environment: "production" }),
		);
		await eventually(async () => expect(target.requests).toHaveLength(1));
		expect(target.requests[0].json.issue.type).toBe("ProdError");
	});

	it("una regla o un canal desactivados no avisan", async () => {
		const t = await createTenant();
		const target = await receiver();
		const channel = await webhookChannel(t, target.url);
		const rule = await createRule(t, {
			name: "r",
			trigger: "new_issue",
			channelIds: [channel.id],
		});
		await t.client.patch(
			`${alerts(t)}/rules/${rule.id}`,
			{ enabled: false },
			t.owner,
		);
		await ingest(t, errorEvent({ type: "A" }));
		await settle(t, 1);

		await t.client.patch(
			`${alerts(t)}/rules/${rule.id}`,
			{ enabled: true },
			t.owner,
		);
		await t.client.patch(
			`${alerts(t)}/channels/${channel.id}`,
			{ enabled: false },
			t.owner,
		);
		// La regla se cachea unos segundos en el worker: se espera a que expire.
		await new Promise((r) => setTimeout(r, 5_500));
		await ingest(t, errorEvent({ type: "B" }));
		await settle(t, 2);
		await new Promise((r) => setTimeout(r, 400));
		expect(target.requests).toHaveLength(0);
		expect((await deliveries(t)).total).toBe(0);
	}, 30_000);

	it("una regla con varios canales avisa a todos", async () => {
		const t = await createTenant();
		const a = await receiver();
		const b = await receiver();
		const ca = await webhookChannel(t, a.url, "A");
		const cb = await webhookChannel(t, b.url, "B");
		await createRule(t, {
			name: "r",
			trigger: "new_issue",
			channelIds: [ca.id, cb.id],
		});
		await ingest(t, errorEvent());
		await eventually(async () => {
			expect(a.requests).toHaveLength(1);
			expect(b.requests).toHaveLength(1);
		});
		// Cada envío firmado con el secreto de su propio canal.
		expect(a.requests[0].headers["x-sentinel-signature"]).not.toBe(
			b.requests[0].headers["x-sentinel-signature"],
		);
	});

	it("los avisos de un proyecto no llegan a los canales de otro", async () => {
		const a = await createTenant();
		const b = await createTenant();
		const target = await receiver();
		const channel = await webhookChannel(b, target.url);
		await createRule(b, {
			name: "r",
			trigger: "new_issue",
			channelIds: [channel.id],
		});
		await ingest(a, errorEvent());
		await settle(a, 1);
		await new Promise((r) => setTimeout(r, 400));
		expect(target.requests).toHaveLength(0);
	});
});

describe("entrega: errores y reintentos", () => {
	const send = async (t: Tenant, target: Receiver) => {
		const channel = await webhookChannel(t, target.url);
		await createRule(t, {
			name: "r",
			trigger: "new_issue",
			channelIds: [channel.id],
		});
		await ingest(t, errorEvent());
	};

	it("reintenta los errores del servidor hasta lograrlo y registra los intentos", async () => {
		const t = await createTenant();
		const target = await receiver();
		target.behavior.failFirst = 2;
		await send(t, target);
		await eventually(
			async () => expect((await deliveries(t)).items[0]?.status).toBe("sent"),
			{ timeoutMs: 20_000 },
		);
		expect(target.requests).toHaveLength(3);
		expect((await deliveries(t)).items[0]).toMatchObject({
			attempts: 3,
			error: null,
			statusCode: 200,
		});
	});

	it("un 4xx no se reintenta: queda fallido con el motivo", async () => {
		const t = await createTenant();
		const target = await receiver();
		target.behavior.status = 404;
		await send(t, target);
		await eventually(async () =>
			expect((await deliveries(t)).items[0]?.status).toBe("failed"),
		);
		await new Promise((r) => setTimeout(r, 600));
		expect(target.requests).toHaveLength(1);
		expect((await deliveries(t)).items[0]).toMatchObject({
			attempts: 1,
			statusCode: 404,
			error: "The endpoint answered HTTP 404",
		});
	});

	it("tras agotar los reintentos queda fallido", async () => {
		const t = await createTenant();
		const target = await receiver();
		target.behavior.status = 500;
		await send(t, target);
		await eventually(
			async () => expect((await deliveries(t)).items[0]?.status).toBe("failed"),
			{ timeoutMs: 25_000 },
		);
		expect(target.requests).toHaveLength(5);
		expect((await deliveries(t)).items[0]).toMatchObject({
			attempts: 5,
			statusCode: 500,
		});
	}, 40_000);

	it("un destino caído falla sin colgar el worker (los siguientes avisos siguen saliendo)", async () => {
		const t = await createTenant();
		const dead = await startReceiver();
		const url = dead.url;
		await dead.close();
		const channel = await webhookChannel(t, url, "Caído");
		const live = await receiver();
		const ok = await webhookChannel(t, live.url, "Vivo");
		await createRule(t, {
			name: "r",
			trigger: "new_issue",
			channelIds: [channel.id, ok.id],
		});
		await ingest(t, errorEvent());
		await eventually(async () => expect(live.requests).toHaveLength(1));
	});

	it("si el canal se borra, el historial lo conserva con su nombre", async () => {
		const t = await createTenant();
		const target = await receiver();
		const channel = await webhookChannel(t, target.url, "Efímero");
		await createRule(t, {
			name: "r",
			trigger: "new_issue",
			channelIds: [channel.id],
		});
		await ingest(t, errorEvent());
		await eventually(async () =>
			expect((await deliveries(t)).items[0]?.status).toBe("sent"),
		);
		await t.client.delete(`${alerts(t)}/channels/${channel.id}`, t.owner);
		const item = (await deliveries(t)).items[0];
		expect(item).toMatchObject({
			channelName: "Efímero",
			channelId: null,
			status: "sent",
		});
	});
});

describe("avisos de prueba", () => {
	it("el botón de prueba envía un aviso real por el canal y queda en el historial", async () => {
		const t = await createTenant();
		const target = await receiver();
		const channel = await webhookChannel(t, target.url);
		const res = await t.client.post(
			`${alerts(t)}/channels/${channel.id}/test`,
			{},
			t.owner,
		);
		expect(res.status).toBe(202);
		expect(res.json).toMatchObject({
			kind: "test",
			status: "pending",
			channelName: "Ops webhook",
		});

		await eventually(async () => expect(target.requests).toHaveLength(1));
		expect(target.requests[0].json.event).toBe("alert.test");
		expect(target.requests[0].headers["x-sentinel-event"]).toBe("alert.test");
		await eventually(async () =>
			expect((await deliveries(t)).items[0]?.status).toBe("sent"),
		);
	});

	it("un destino que falla en la prueba lo muestra sin reintentar", async () => {
		const t = await createTenant();
		const target = await receiver();
		target.behavior.status = 500;
		const channel = await webhookChannel(t, target.url);
		await t.client.post(
			`${alerts(t)}/channels/${channel.id}/test`,
			{},
			t.owner,
		);
		await eventually(async () =>
			expect((await deliveries(t)).items[0]?.status).toBe("failed"),
		);
		expect(target.requests).toHaveLength(1);
		expect((await deliveries(t)).items[0].error).toContain("500");
	});
});

describe("Slack", () => {
	it("recibe un mensaje con bloques y enlace, sin cabeceras de firma", async () => {
		const t = await createTenant();
		const target = await receiver();
		const channel = await createChannel(t, {
			type: "slack",
			name: "Slack",
			url: target.url,
		});
		await createRule(t, {
			name: "r",
			trigger: "new_issue",
			channelIds: [channel.id],
		});
		await ingest(t, errorEvent({ type: "SlackError", value: "boom <b>&</b>" }));
		await eventually(async () => expect(target.requests).toHaveLength(1));
		const [request] = target.requests;
		expect(request.headers["x-sentinel-signature"]).toBeUndefined();
		expect(request.json.text).toContain("New issue");
		expect(request.json.blocks.length).toBeGreaterThanOrEqual(2);
		expect(JSON.stringify(request.json.blocks)).toContain("/issues/");
		expect(JSON.stringify(request.json.blocks)).not.toContain("<b>");
	});
});

describe("email", () => {
	it("avisa a todos los miembros, un correo para cada uno, con el enlace al issue", async () => {
		const t = await createTenant();
		const member = await t.client.signUp("member");
		await t.client.addMember(t.owner, t.orgId, member, "member");
		const channel = await createChannel(t, {
			type: "email",
			name: "Todos",
			recipients: { mode: "all" },
		});
		await createRule(t, {
			name: "Nuevos",
			trigger: "new_issue",
			channelIds: [channel.id],
		});

		await ingest(t, errorEvent({ type: "MailError" }));
		await eventually(async () =>
			expect(
				mails().filter((m) => m.subject.includes("MailError")),
			).toHaveLength(2),
		);
		const received = mails().filter((m) => m.subject.includes("MailError"));

		expect(received.flatMap((m) => m.to).sort()).toEqual(
			[member.email, t.owner.email].sort(),
		);
		expect(received.every((m) => m.to.length === 1)).toBe(true); // nadie ve las direcciones de los demás
		const [mail] = received;
		expect(mail.from).toContain("alerts@sentinel.test");
		expect(mail.subject).toMatch(/^\[App\] New issue: MailError/);
		expect(mail.text).toContain("Nuevos");
		expect(mail.text).toMatch(
			/http:\/\/localhost:5173\/.+\/issues\/[0-9a-f-]{36}/,
		);
		expect(mail.html).toContain("View the issue");
	});

	it("con destinatarios concretos solo avisa a esos", async () => {
		const t = await createTenant();
		const member = await t.client.signUp("member");
		await t.client.addMember(t.owner, t.orgId, member, "member");
		const me = await t.client.get("/api/auth/get-session", member);
		const channel = await createChannel(t, {
			type: "email",
			name: "Solo uno",
			recipients: { mode: "members", userIds: [me.json.user.id] },
		});
		await createRule(t, {
			name: "r",
			trigger: "new_issue",
			channelIds: [channel.id],
		});
		await ingest(t, errorEvent({ type: "OnlyOne" }));
		await eventually(async () =>
			expect(mails().filter((m) => m.subject.includes("OnlyOne"))).toHaveLength(
				1,
			),
		);
		await new Promise((r) => setTimeout(r, 400));
		const received = mails().filter((m) => m.subject.includes("OnlyOne"));
		expect(received).toHaveLength(1);
		expect(received[0].to).toEqual([member.email]);
	});

	it("el contenido controlado por la app monitoreada no inyecta HTML en el correo", async () => {
		const t = await createTenant();
		const channel = await createChannel(t, {
			type: "email",
			name: "Todos",
			recipients: { mode: "all" },
		});
		await createRule(t, {
			name: "r",
			trigger: "new_issue",
			channelIds: [channel.id],
		});
		await ingest(
			t,
			errorEvent({ type: "XssError", value: '<img src=x onerror="alert(1)">' }),
		);
		await eventually(async () =>
			expect(
				mails().filter((m) => m.subject.includes("XssError")),
			).toHaveLength(1),
		);
		const [mail] = mails().filter((m) => m.subject.includes("XssError"));
		expect(mail.html).not.toContain("<img");
	});

	it("la configuración pública indica que el correo está activo", async () => {
		const res = await createTenant().then((t) => t.client.get("/api/config"));
		expect(res.json.emailEnabled).toBe(true);
	});
});
