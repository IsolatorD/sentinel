import { errorResponseSchema, ingestResponseSchema } from "@sentinel/shared";
import { Queue, QueueEvents } from "bullmq";
import { afterAll, describe, expect, inject, it } from "vitest";
import { scalar } from "../support/db.js";
import { eventually } from "../support/eventually.js";
import {
	api,
	createTenant,
	errorEvent,
	minutesAgo,
} from "../support/factories.js";

const countEvents = (projectId: string) =>
	scalar("select count(*) from event where project_id = $1", [projectId]);
const countIssues = (projectId: string) =>
	scalar("select count(*) from issue where project_id = $1", [projectId]);

describe("ingesta: autenticación por clave", () => {
	it("sin clave, con clave inválida, mal formada, de otro proyecto o revocada: 401", async () => {
		const t = await createTenant();
		const other = await createTenant();
		const event = errorEvent();

		expect((await t.client.ingest(t.projectId, undefined, event)).status).toBe(
			401,
		);
		expect(
			(await t.client.ingest(t.projectId, "0".repeat(32), event)).status,
		).toBe(401);
		expect(
			(await t.client.ingest(t.projectId, "no-es-hex", event)).status,
		).toBe(401);
		expect((await t.client.ingest(t.projectId, other.key, event)).status).toBe(
			401,
		);

		await t.client.patch(
			`${t.projectPath}/keys/${t.keyId}`,
			{ isActive: false },
			t.owner,
		);
		const revoked = await t.client.ingest(t.projectId, t.key, event);
		expect(revoked.status).toBe(401);
		expect(errorResponseSchema.parse(revoked.json)).toMatchObject({
			code: "UNAUTHORIZED",
		});

		await new Promise((r) => setTimeout(r, 300));
		expect(await countEvents(t.projectId)).toBe(0);
	});

	it("un id de proyecto que no es UUID da 400", async () => {
		const t = await createTenant();
		expect(
			(await t.client.ingest("no-es-uuid", t.key, errorEvent())).status,
		).toBe(400);
	});

	it("la clave también se acepta por query (sendBeacon no puede enviar headers)", async () => {
		const t = await createTenant();
		const res = await t.client.request(
			`/api/${t.projectId}/events?sentinel_key=${t.key}`,
			{
				method: "POST",
				body: { level: "info", message: "desde un beacon" },
				origin: null,
			},
		);
		expect(res.status).toBe(202);
		await eventually(async () =>
			expect(await countEvents(t.projectId)).toBe(1),
		);
	});
});

describe("ingesta: validación y límites", () => {
	it("rechaza payloads inválidos con 400 y el detalle de los campos", async () => {
		const t = await createTenant();
		const res = await t.client.ingest(t.projectId, t.key, {
			level: "nope",
			exception: { values: [] },
		});
		expect(res.status).toBe(400);
		const body = errorResponseSchema.parse(res.json);
		expect(body.code).toBe("VALIDATION_FAILED");
		expect(body.issues?.map((i) => i.path)).toEqual(
			expect.arrayContaining(["level", "exception.values"]),
		);

		expect(
			(
				await t.client.ingest(t.projectId, t.key, {
					event_id: "zzz",
					message: "x",
				})
			).status,
		).toBe(400);
		expect(
			(
				await t.client.ingest(t.projectId, t.key, {
					message: "x".repeat(20_000),
				})
			).status,
		).toBe(400);
		expect(
			(
				await t.client.request(`/api/${t.projectId}/events`, {
					method: "POST",
					rawBody: '{"message":',
					origin: null,
					headers: { "X-Sentinel-Key": t.key },
				})
			).status,
		).toBe(400);
	});

	it("un cuerpo de más de 1 MB da 413", async () => {
		const t = await createTenant();
		const res = await t.client.ingest(t.projectId, t.key, {
			message: "x".repeat(1_200_000),
		});
		expect(res.status).toBe(413);
		expect(errorResponseSchema.parse(res.json).code).toBe("PAYLOAD_TOO_LARGE");
	});

	it("nada de lo rechazado llega a guardarse", async () => {
		const t = await createTenant();
		await t.client.ingest(t.projectId, t.key, { level: "nope" });
		await t.client.ingest(t.projectId, "0".repeat(32), errorEvent());
		await new Promise((r) => setTimeout(r, 400));
		expect(await countEvents(t.projectId)).toBe(0);
	});
});

describe("ingesta: procesamiento y agrupación", () => {
	it("acepta el evento con 202 y lo convierte en un issue con título y culprit", async () => {
		const t = await createTenant();
		const res = await t.client.ingest(
			t.projectId,
			t.key,
			errorEvent({ user: "u1" }),
		);
		expect(res.status).toBe(202);
		const { id } = ingestResponseSchema.parse(res.json);

		await eventually(async () =>
			expect(await countEvents(t.projectId)).toBe(1),
		);
		expect(
			await scalar("select id from event where project_id = $1", [t.projectId]),
		).toBe(id);
		const [issue] = (await t.client.get(`${t.projectPath}/issues`, t.owner))
			.json.items;
		expect(issue).toMatchObject({
			title: "TypeError: x is undefined",
			culprit: "computeTotal (Cart.js:10)",
			type: "TypeError",
			eventCount: 1,
			status: "unresolved",
		});
	});

	it("agrupa el mismo error aunque cambien el mensaje, la línea o el hash del bundle", async () => {
		const t = await createTenant();
		const variant = (value: string, lineno: number, bundle: string) => {
			const e = errorEvent({ value });
			e.exception.values[0].stacktrace.frames[0].lineno = lineno;
			e.exception.values[0].stacktrace.frames[0].filename = `https://app.example.com/assets/Cart.${bundle}.js?v=${lineno}`;
			return e;
		};
		await t.client.ingest(
			t.projectId,
			t.key,
			variant("User 123 not found", 10, "3f2a1b9c"),
		);
		await t.client.ingest(
			t.projectId,
			t.key,
			variant("User 987 not found", 55, "aabbccdd"),
		);
		await t.client.ingest(
			t.projectId,
			t.key,
			variant("Order 5 not found", 99, "11223344"),
		);

		await eventually(async () =>
			expect(await countEvents(t.projectId)).toBe(3),
		);
		expect(await countIssues(t.projectId)).toBe(1);
		expect(
			await scalar("select event_count from issue where project_id = $1", [
				t.projectId,
			]),
		).toBe(3);
	});

	it("errores distintos forman issues distintos", async () => {
		const t = await createTenant();
		await t.client.ingest(t.projectId, t.key, errorEvent());
		await t.client.ingest(
			t.projectId,
			t.key,
			errorEvent({ type: "RangeError" }),
		);
		await t.client.ingest(
			t.projectId,
			t.key,
			errorEvent({ fn: "otraFuncion" }),
		);
		await eventually(async () =>
			expect(await countIssues(t.projectId)).toBe(3),
		);
	});

	it("un fingerprint personalizado agrupa por el criterio del SDK", async () => {
		const t = await createTenant();
		await t.client.ingest(t.projectId, t.key, {
			message: "uno",
			fingerprint: ["checkout"],
		});
		await t.client.ingest(t.projectId, t.key, {
			message: "dos totalmente distinto",
			fingerprint: ["checkout"],
		});
		await eventually(async () =>
			expect(await countEvents(t.projectId)).toBe(2),
		);
		expect(await countIssues(t.projectId)).toBe(1);
	});

	it("los eventos de mensaje (sin excepción) también generan issues", async () => {
		const t = await createTenant();
		await t.client.ingest(t.projectId, t.key, {
			level: "info",
			message: "Pedido 123 completado",
		});
		await t.client.ingest(t.projectId, t.key, {
			level: "info",
			message: "Pedido 456 completado",
		});
		await eventually(async () =>
			expect(await countEvents(t.projectId)).toBe(2),
		);
		expect(await countIssues(t.projectId)).toBe(1);
		expect(
			await scalar("select type from issue where project_id = $1", [
				t.projectId,
			]),
		).toBe("message");
	});

	it("guarda release, entorno y usuario; cuenta usuarios distintos", async () => {
		const t = await createTenant();
		await t.client.ingest(
			t.projectId,
			t.key,
			errorEvent({ user: "a", release: "2.0.0", environment: "staging" }),
		);
		await t.client.ingest(t.projectId, t.key, errorEvent({ user: "b" }));
		await t.client.ingest(t.projectId, t.key, errorEvent({ user: "a" }));
		await eventually(async () =>
			expect(await countEvents(t.projectId)).toBe(3),
		);
		const issue = (await t.client.get(`${t.projectPath}/issues`, t.owner)).json
			.items[0];
		expect(issue.userCount).toBe(2);
		expect(
			await scalar(
				"select release || '/' || environment from event where user_identifier = 'a' order by received_at limit 1",
				[],
			),
		).toBe("2.0.0/staging");
	});

	it("respeta el timestamp del evento (ISO o epoch) y recorta los que vienen del futuro", async () => {
		const t = await createTenant();
		const past = minutesAgo(120);
		await t.client.ingest(
			t.projectId,
			t.key,
			errorEvent({ type: "A", timestamp: past }),
		);
		await t.client.ingest(t.projectId, t.key, {
			...errorEvent({ type: "B" }),
			timestamp: Math.floor((Date.now() - 60 * 60_000) / 1000),
		});
		await t.client.ingest(
			t.projectId,
			t.key,
			errorEvent({
				type: "C",
				timestamp: new Date(Date.now() + 86_400_000).toISOString(),
			}),
		);
		await eventually(async () =>
			expect(await countEvents(t.projectId)).toBe(3),
		);

		const at = (type: string) =>
			scalar<Date>(
				"select timestamp from event where project_id = $1 and type = $2",
				[t.projectId, type],
			);
		expect((await at("A")).toISOString()).toBe(past);
		expect(
			Math.abs((await at("B")).getTime() - (Date.now() - 3_600_000)),
		).toBeLessThan(5_000);
		// El del futuro se guarda con la hora de recepción, no con la de mañana.
		expect(Math.abs((await at("C")).getTime() - Date.now())).toBeLessThan(
			60_000,
		);
	});
});

describe("ingesta: idempotencia", () => {
	const { redis } = inject("e2e");
	const connection = { host: redis.host, port: redis.port, db: redis.db };
	const queue = new Queue("events", { connection });
	const queueEvents = new QueueEvents("events", { connection });
	afterAll(async () => {
		await queueEvents.close();
		await queue.close();
	});

	it("reenviar el mismo event_id no duplica el evento ni suma al contador", async () => {
		const t = await createTenant();
		const eventId = "11111111-2222-4333-8444-555555555555";
		const first = await t.client.ingest(
			t.projectId,
			t.key,
			errorEvent({ eventId }),
		);
		expect(first.json.id).toBe(eventId);
		await eventually(async () =>
			expect(await countEvents(t.projectId)).toBe(1),
		);

		const again = await t.client.ingest(
			t.projectId,
			t.key,
			errorEvent({ eventId }),
		);
		expect(again.status).toBe(202);
		await new Promise((r) => setTimeout(r, 800));
		expect(await countEvents(t.projectId)).toBe(1);
		expect(
			await scalar("select event_count from issue where project_id = $1", [
				t.projectId,
			]),
		).toBe(1);
	});

	it("un job duplicado que sí llega al worker (reintento) se deshace sin contar dos veces", async () => {
		const t = await createTenant();
		const eventId = "22222222-3333-4444-8555-666666666666";
		await t.client.ingest(t.projectId, t.key, errorEvent({ eventId }));
		await eventually(async () =>
			expect(await countEvents(t.projectId)).toBe(1),
		);

		// Mismo evento con otro jobId: BullMQ no lo deduplica y el worker lo procesa de nuevo.
		const job = await queue.add(
			"ingest",
			{
				projectId: t.projectId,
				eventId,
				receivedAt: new Date().toISOString(),
				event: errorEvent({ eventId }),
				client: {},
			},
			{ jobId: `reintento-${eventId}-${Date.now()}` },
		);
		await job.waitUntilFinished(queueEvents, 15_000);

		expect(await countEvents(t.projectId)).toBe(1);
		expect(
			await scalar("select event_count from issue where project_id = $1", [
				t.projectId,
			]),
		).toBe(1);
	});
});

describe("ingesta: estado de los issues", () => {
	it("un issue resuelto que vuelve a ocurrir se reabre; uno ignorado sigue ignorado", async () => {
		const t = await createTenant();
		await t.client.ingest(t.projectId, t.key, errorEvent({ type: "ReopenMe" }));
		await t.client.ingest(
			t.projectId,
			t.key,
			errorEvent({ type: "KeepIgnored" }),
		);
		await eventually(async () =>
			expect(await countIssues(t.projectId)).toBe(2),
		);
		const issues = (await t.client.get(`${t.projectPath}/issues`, t.owner)).json
			.items as Array<{ id: string; type: string }>;
		const id = (type: string) => issues.find((i) => i.type === type)?.id;

		await t.client.patch(
			`${t.projectPath}/issues/${id("ReopenMe")}`,
			{ status: "resolved" },
			t.owner,
		);
		await t.client.patch(
			`${t.projectPath}/issues/${id("KeepIgnored")}`,
			{ status: "ignored" },
			t.owner,
		);
		await t.client.ingest(t.projectId, t.key, errorEvent({ type: "ReopenMe" }));
		await t.client.ingest(
			t.projectId,
			t.key,
			errorEvent({ type: "KeepIgnored" }),
		);

		await eventually(async () => {
			const get = async (type: string) =>
				(await t.client.get(`${t.projectPath}/issues/${id(type)}`, t.owner))
					.json;
			expect(await get("ReopenMe")).toMatchObject({
				status: "unresolved",
				eventCount: 2,
			});
			expect(await get("KeepIgnored")).toMatchObject({
				status: "ignored",
				eventCount: 2,
			});
		});
	});
});

describe("ingesta: CORS", () => {
	it("la ruta de ingesta acepta cualquier origen (la llaman los SDK desde otros sitios)", async () => {
		const t = await createTenant();
		const res = await t.client.request(`/api/${t.projectId}/events`, {
			method: "OPTIONS",
			origin: "https://sitio-cliente.example",
			headers: {
				"Access-Control-Request-Method": "POST",
				"Access-Control-Request-Headers": "content-type,x-sentinel-key",
			},
		});
		expect(res.headers.get("access-control-allow-origin")).toBe("*");
		expect(
			res.headers.get("access-control-allow-headers")?.toLowerCase(),
		).toContain("x-sentinel-key");
		expect(res.headers.get("access-control-allow-credentials")).toBeNull();

		const post = await t.client.ingest(t.projectId, t.key, errorEvent(), {
			origin: "https://sitio-cliente.example",
		});
		expect(post.headers.get("access-control-allow-origin")).toBe("*");
	});

	it("el resto de la API solo acepta el origen del dashboard", async () => {
		const client = api();
		const foreign = await client.get("/api/health", undefined, {
			origin: "https://sitio-cliente.example",
		});
		expect(foreign.headers.get("access-control-allow-origin")).not.toBe("*");
		expect(foreign.headers.get("access-control-allow-origin")).not.toBe(
			"https://sitio-cliente.example",
		);

		const dashboard = await client.get("/api/health");
		expect(dashboard.headers.get("access-control-allow-origin")).toBe(
			"http://localhost:5173",
		);
		expect(dashboard.headers.get("access-control-allow-credentials")).toBe(
			"true",
		);
	});
});

describe("ingesta: límites de ritmo", () => {
	it("supera el límite por proyecto: 429 con Retry-After, y otro proyecto no se ve afectado", async () => {
		const { ingestRateLimitPerMinute: limit } = inject("e2e");
		const t = await createTenant();
		const other = await createTenant();

		const statuses: number[] = [];
		let retryAfter: string | null = null;
		for (let i = 0; i < limit + 6; i++) {
			const res = await t.client.ingest(t.projectId, t.key, {
				level: "info",
				message: `carga ${i}`,
			});
			statuses.push(res.status);
			if (res.status === 429) retryAfter = res.headers.get("retry-after");
		}
		expect(statuses.filter((s) => s === 202)).toHaveLength(limit);
		expect(statuses.filter((s) => s === 429)).toHaveLength(6);
		expect(Number(retryAfter)).toBeGreaterThan(0);
		expect(Number(retryAfter)).toBeLessThanOrEqual(60);

		expect(
			(await other.client.ingest(other.projectId, other.key, errorEvent()))
				.status,
		).toBe(202);
	});

	// Va al final: bloquea las claves inválidas de esta IP durante un minuto.
	it("tras muchas claves inválidas se frena a ese cliente, pero una clave válida nunca se bloquea", async () => {
		const t = await createTenant();
		const results: number[] = [];
		for (let i = 0; i < 35; i++) {
			results.push(
				(await t.client.ingest(t.projectId, "f".repeat(32), errorEvent()))
					.status,
			);
		}
		expect(results.filter((s) => s === 401).length).toBeGreaterThan(0);
		expect(results.filter((s) => s === 429).length).toBeGreaterThanOrEqual(4);
		// Una vez que empieza a frenar, no vuelve a 401 dentro de la ventana.
		const firstBlocked = results.indexOf(429);
		expect(results.slice(firstBlocked).every((s) => s === 429)).toBe(true);

		expect(
			(await t.client.ingest(t.projectId, t.key, errorEvent())).status,
		).toBe(202);
	});
});

describe("datos sensibles", () => {
	it("se eliminan antes de guardar el evento, por clave y por contenido", async () => {
		const t = await createTenant();
		const res = await t.client.ingest(t.projectId, t.key, {
			level: "error",
			message: "Pago rechazado con 4242 4242 4242 4242",
			user: { id: "u1", email: "ana@example.com" },
			request: {
				url: "https://shop.dev/cart?access_token=abc123&page=2",
				headers: {
					Authorization: "Bearer abcdefghijkl",
					"User-Agent": "Mozilla",
				},
			},
			extra: { form: { password: "hunter2", name: "Ana" } },
			exception: {
				values: [{ type: "Error", value: "login failed password=hunter2" }],
			},
		});
		expect(res.status).toBe(202);

		await eventually(async () => {
			const { items } = (
				await t.client.get(`${t.projectPath}/issues?status=all`, t.owner)
			).json;
			expect(items).toHaveLength(1);
		});
		const issues = (
			await t.client.get(`${t.projectPath}/issues?status=all`, t.owner)
		).json;
		const issue = issues.items[0];
		const events = (
			await t.client.get(`${t.projectPath}/issues/${issue.id}/events`, t.owner)
		).json;
		const detail = (
			await t.client.get(
				`${t.projectPath}/issues/${issue.id}/events/${events.items[0].id}`,
				t.owner,
			)
		).json;
		const payload = JSON.stringify(detail.payload);

		for (const secret of ["hunter2", "4242 4242", "abc123", "abcdefghijkl"]) {
			expect(payload, secret).not.toContain(secret);
		}
		expect(detail.payload.request.headers).toEqual({
			Authorization: "[Filtered]",
			"User-Agent": "Mozilla",
		});
		expect(detail.payload.request.url).toBe(
			"https://shop.dev/cart?access_token=[Filtered]&page=2",
		);
		expect(detail.payload.extra.form).toEqual({
			password: "[Filtered]",
			name: "Ana",
		});
		// Lo que no es sensible se conserva, incluida la identificación del usuario.
		expect(detail.payload.user).toEqual({ id: "u1", email: "ana@example.com" });
		expect(detail.message).not.toContain("hunter2");
	});
});
