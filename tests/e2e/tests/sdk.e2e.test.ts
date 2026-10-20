// @vitest-environment jsdom
import { SentinelClient } from "@argus-isolator/browser";
import { eventDetailDtoSchema } from "@sentinel/shared";
import { afterEach, describe, expect, it } from "vitest";
import { scalar } from "../support/db.js";
import { eventually } from "../support/eventually.js";
import { createTenant, type Tenant } from "../support/factories.js";

// El SDK real (el que se publica) enviando a la API real, procesado por el worker real.
const clients: SentinelClient[] = [];
const newClient = (
	t: Tenant,
	options: Partial<ConstructorParameters<typeof SentinelClient>[0]> = {},
) => {
	const client = new SentinelClient({ dsn: t.dsn, ...options });
	clients.push(client);
	return client;
};
const issuesOf = async (t: Tenant) =>
	(await t.client.get(`${t.projectPath}/issues?status=all`, t.owner)).json
		.items;

afterEach(async () => {
	await Promise.all(clients.splice(0).map((c) => c.close()));
});

describe("SDK de navegador contra la API real", () => {
	it("una transacción medida con el SDK llega, se procesa y queda guardada con sus spans", async () => {
		const t = await createTenant();
		const sdk = newClient(t, {
			release: "9.9.9",
			tracesSampleRate: 1,
			tracing: { pageload: false, navigation: false, http: false },
		});
		const tx = sdk.startTransaction({ name: "/importar", op: "task" });
		await sdk.trace("parse", "csv", async () => {
			await new Promise((r) => setTimeout(r, 15));
		});
		tx?.setMeasurement("rows", 120);
		tx?.finish();
		await sdk.flush();

		await eventually(async () =>
			expect(
				await scalar(
					"select count(*) from perf_transaction where project_id = $1 and name = '/importar' and release = '9.9.9'",
					[t.projectId],
				),
			).toBe(1),
		);
		expect(
			await scalar(
				"select count(*) from perf_span s join perf_transaction x on x.id = s.transaction_id where x.project_id = $1 and s.op = 'parse' and s.description = 'csv'",
				[t.projectId],
			),
		).toBe(1);
		expect(
			await scalar(
				"select (measurements->'rows'->>'value')::float from perf_transaction where project_id = $1",
				[t.projectId],
			),
		).toBe(120);
	});

	it("captureException llega, se procesa y queda como issue con su stacktrace", async () => {
		const t = await createTenant();
		const sdk = newClient(t, { release: "9.9.9", environment: "e2e" });
		const id = sdk.captureException(
			new TypeError("Cannot read properties of undefined (reading 'total')"),
		);
		await sdk.flush();

		await eventually(async () => expect(await issuesOf(t)).toHaveLength(1));
		const [issue] = await issuesOf(t);
		expect(issue).toMatchObject({
			type: "TypeError",
			title: "TypeError: Cannot read properties of undefined (reading 'total')",
			eventCount: 1,
		});

		const detail = (
			await t.client.get(`${t.projectPath}/issues/${issue.id}`, t.owner)
		).json;
		const event = eventDetailDtoSchema.parse(detail.latestEvent);
		expect(event).toMatchObject({
			id,
			release: "9.9.9",
			environment: "e2e",
			platform: "javascript",
		});
		const frames = (
			event.payload as {
				exception: { values: Array<{ stacktrace: { frames: unknown[] } }> };
			}
		).exception.values[0].stacktrace.frames;
		expect(frames.length).toBeGreaterThan(0);
	});

	it("el contexto llega completo: usuario, tags, extra y breadcrumbs", async () => {
		const t = await createTenant();
		const sdk = newClient(t);
		sdk.setUser({ id: "user_42", email: "ana@example.com" });
		sdk.setTag("feature", "checkout");
		sdk.addBreadcrumb({ category: "ui.click", message: "button#pay" });
		sdk.captureException(new Error("falló el pago"), {
			extra: { orderId: 99 },
		});
		await sdk.flush();

		await eventually(async () => expect(await issuesOf(t)).toHaveLength(1));
		const [issue] = await issuesOf(t);
		const detail = (
			await t.client.get(`${t.projectPath}/issues/${issue.id}`, t.owner)
		).json;
		expect(detail.userCount).toBe(1);
		expect(detail.latestEvent.userIdentifier).toBe("user_42");
		expect(detail.latestEvent.payload).toMatchObject({
			user: { id: "user_42", email: "ana@example.com" },
			tags: { feature: "checkout" },
			extra: { orderId: 99 },
			breadcrumbs: [{ category: "ui.click", message: "button#pay" }],
			contexts: { sdk: { name: "sentinel.javascript.browser" } },
		});
	});

	it("captureMessage y la cadena de causas se aceptan y se agrupan", async () => {
		const t = await createTenant();
		const sdk = newClient(t);
		sdk.captureMessage("Checkout completado", "info");
		sdk.captureException(
			new Error("no se pudo guardar", { cause: new Error("conexión perdida") }),
		);
		await sdk.flush();

		await eventually(async () => expect(await issuesOf(t)).toHaveLength(2));
		const chained = (await issuesOf(t)).find(
			(i: { type: string }) => i.type === "Error",
		);
		const detail = (
			await t.client.get(`${t.projectPath}/issues/${chained.id}`, t.owner)
		).json;
		const values = detail.latestEvent.payload.exception.values;
		expect(values.map((v: { value: string }) => v.value)).toEqual([
			"conexión perdida",
			"no se pudo guardar",
		]);
	});

	it("los errores globales (window.onerror) se capturan con el SDK instalado", async () => {
		const t = await createTenant();
		const sdk = newClient(t).install();
		// jsdom/Vitest tratan un ErrorEvent sin preventDefault como error sin manejar.
		const swallow = (e: Event) => e.preventDefault();
		window.addEventListener("error", swallow);
		window.dispatchEvent(
			new ErrorEvent("error", {
				error: new RangeError("global"),
				message: "global",
			}),
		);
		window.removeEventListener("error", swallow);
		await sdk.flush();

		await eventually(async () => expect(await issuesOf(t)).toHaveLength(1));
		const [issue] = await issuesOf(t);
		const detail = (
			await t.client.get(`${t.projectPath}/issues/${issue.id}`, t.owner)
		).json;
		expect(detail.latestEvent.payload.tags).toMatchObject({
			handled: "false",
			mechanism: "onerror",
		});
	});

	it("con una clave revocada el SDK no lanza ni rompe la app, y no se guarda nada", async () => {
		const t = await createTenant();
		await t.client.patch(
			`${t.projectPath}/keys/${t.keyId}`,
			{ isActive: false },
			t.owner,
		);
		const sdk = newClient(t);

		expect(() =>
			sdk.captureException(new Error("no debería llegar")),
		).not.toThrow();
		await expect(sdk.flush()).resolves.toBe(true);
		await new Promise((r) => setTimeout(r, 500));
		expect(await issuesOf(t)).toHaveLength(0);
	});

	it("todo evento que el SDK produce cumple el contrato de ingesta (nunca recibe 400)", async () => {
		const t = await createTenant();
		const sdk = newClient(t, { maxEventsPerMinute: 100 });
		const circular: Record<string, unknown> = { name: "ciclo" };
		circular.self = circular;
		const weird: unknown[] = [
			new Error("normal"),
			"un string",
			{ code: 42 },
			null,
			undefined,
			42,
			circular,
			new Error("x".repeat(50_000)),
			Object.assign(new Error("con extra"), { cause: "causa en texto" }),
		];
		weird.forEach((value, i) => {
			sdk.setTag("n", String(i));
			sdk.captureException(value, {
				extra: { value: circular, deep: { a: { b: { c: { d: 1 } } } } },
			});
		});
		await sdk.flush();

		await eventually(async () => {
			const total = (await issuesOf(t)).reduce(
				(n: number, i: { eventCount: number }) => n + i.eventCount,
				0,
			);
			expect(total).toBe(weird.length);
		});
	});
});
