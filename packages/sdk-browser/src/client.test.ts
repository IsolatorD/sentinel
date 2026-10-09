import { type IngestEvent, ingestEventSchema } from "@sentinel/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createTestClient } from "./test-utils";
import type { SentinelEvent } from "./types";

// Comprobación en compilación: el evento del SDK debe ser asignable al contrato del servidor.
const _assignable = (e: SentinelEvent): IngestEvent => e;
void _assignable;

afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
	history.replaceState({}, "", "/");
});

describe("SentinelClient: construcción del evento", () => {
	it("captureException produce un evento que el servidor acepta", async () => {
		const { client, sent } = createTestClient({
			release: "1.4.2",
			environment: "production",
		});
		client.setUser({ id: "u_1", email: "ana@example.com" });
		client.setTag("feature", "checkout");
		client.addBreadcrumb({ category: "ui.click", message: "button#pay" });

		const id = client.captureException(
			new TypeError("Cannot read properties of undefined"),
		);
		await client.flush();

		expect(sent).toHaveLength(1);
		const event = sent[0];
		expect(event.event_id).toBe(id);

		// Contrato con el backend: mismo esquema Zod que valida la ingesta.
		const parsed = ingestEventSchema.safeParse(event);
		expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);

		expect(event).toMatchObject({
			level: "error",
			platform: "javascript",
			release: "1.4.2",
			environment: "production",
			user: { id: "u_1", email: "ana@example.com" },
			tags: { feature: "checkout" },
			contexts: { sdk: { name: "sentinel.javascript.browser" } },
		});
		expect(event.exception?.values[0]).toMatchObject({
			type: "TypeError",
			value: "Cannot read properties of undefined",
		});
		expect(
			event.exception?.values[0].stacktrace?.frames.length,
		).toBeGreaterThan(0);
		expect(event.breadcrumbs).toEqual([
			expect.objectContaining({ category: "ui.click", message: "button#pay" }),
		]);
		expect(typeof event.timestamp).toBe("string");
	});

	it("captureMessage acepta un nivel o un hint", async () => {
		const { client, sent } = createTestClient();
		client.captureMessage("hola");
		client.captureMessage("cuidado", "warning");
		client.captureMessage("con hint", { level: "fatal", tags: { a: "1" } });
		await client.flush();

		expect(sent.map((e) => [e.message, e.level])).toEqual([
			["hola", "info"],
			["cuidado", "warning"],
			["con hint", "fatal"],
		]);
		for (const e of sent)
			expect(ingestEventSchema.safeParse(e).success).toBe(true);
	});

	it("combina scope global y hint (el hint prevalece)", async () => {
		const { client, sent } = createTestClient({ tags: { app: "web" } });
		client.setTags({ a: "global", b: "global" });
		client.setContext("cart", { items: 3 });
		client.setExtra("route", "/checkout");
		client.captureException(new Error("x"), {
			tags: { b: "hint" },
			extra: { step: 2 },
			user: { id: "u2" },
			contexts: { order: { id: "o1" } },
			fingerprint: ["checkout-failure"],
		});
		await client.flush();

		expect(sent[0]).toMatchObject({
			tags: { app: "web", a: "global", b: "hint" },
			extra: { route: "/checkout", step: 2 },
			user: { id: "u2" },
			contexts: { cart: { items: 3 }, order: { id: "o1" } },
			fingerprint: ["checkout-failure"],
		});
		client.setContext("cart", null);
		client.captureMessage("otro");
		await client.flush();
		expect(sent[1].contexts?.cart).toBeUndefined();
	});

	it("por privacidad la URL se envía sin query ni hash, salvo sendFullUrl", async () => {
		history.replaceState({}, "", "/pay?token=secreto#paso-2");
		const a = createTestClient();
		a.client.captureMessage("x");
		await a.client.flush();
		expect(a.sent[0].request?.url).toBe("http://localhost:3000/pay");

		const b = createTestClient({ sendFullUrl: true });
		b.client.captureMessage("x");
		await b.client.flush();
		expect(b.sent[0].request?.url).toBe(
			"http://localhost:3000/pay?token=secreto#paso-2",
		);
	});

	it("limita los breadcrumbs a maxBreadcrumbs, conservando los más recientes", async () => {
		const { client, sent } = createTestClient({ maxBreadcrumbs: 3 });
		for (let i = 0; i < 10; i++) client.addBreadcrumb({ message: `b${i}` });
		client.captureMessage("x");
		await client.flush();
		expect(sent[0].breadcrumbs?.map((b) => b.message)).toEqual([
			"b7",
			"b8",
			"b9",
		]);
	});
});

describe("SentinelClient: desactivación y robustez", () => {
	it("con una DSN inválida queda desactivado sin lanzar", async () => {
		const { client, fetchImpl } = createTestClient({ dsn: "basura" });
		expect(client.enabled).toBe(false);
		expect(client.captureException(new Error("x"))).toBeUndefined();
		expect(client.captureMessage("x")).toBeUndefined();
		await client.flush();
		expect(fetchImpl).not.toHaveBeenCalled();
	});

	it("enabled: false no envía nada", async () => {
		const { client, fetchImpl } = createTestClient({ enabled: false });
		expect(client.captureException(new Error("x"))).toBeUndefined();
		await client.flush();
		expect(fetchImpl).not.toHaveBeenCalled();
	});

	it("nunca lanza, aunque se capture algo patológico", async () => {
		const { client } = createTestClient();
		const circular: Record<string, unknown> = {};
		circular.self = circular;
		const hostile = new Proxy(
			{},
			{
				get: () => {
					throw new Error("no me leas");
				},
			},
		);
		for (const value of [
			circular,
			hostile,
			Symbol("s"),
			10n,
			() => 1,
			null,
			undefined,
		]) {
			expect(() => client.captureException(value)).not.toThrow();
		}
		await client.flush();
	});

	it("no pierde el evento si beforeSend lanza", async () => {
		const { client, sent } = createTestClient({
			beforeSend: () => {
				throw new Error("bug en beforeSend");
			},
		});
		client.captureMessage("x");
		await client.flush();
		expect(sent).toHaveLength(1);
	});
});

describe("SentinelClient: filtros", () => {
	it("ignora por defecto 'Script error.' y los avisos de ResizeObserver", async () => {
		const { client, fetchImpl } = createTestClient();
		client.captureException(new Error("Script error."));
		client.captureException(
			new Error(
				"ResizeObserver loop completed with undelivered notifications.",
			),
		);
		client.captureException(new Error("ResizeObserver loop limit exceeded"));
		await client.flush();
		expect(fetchImpl).not.toHaveBeenCalled();
	});

	it("ignoreErrors acepta strings (contiene) y expresiones regulares", async () => {
		const { client, sent } = createTestClient({
			ignoreErrors: ["NetworkError", /^Timeout \d+ms$/],
		});
		client.captureException(new Error("A NetworkError occurred"));
		client.captureException(new Error("Timeout 3000ms"));
		client.captureException(new Error("Otro error"));
		await client.flush();
		expect(sent.map((e) => e.exception?.values[0].value)).toEqual([
			"Otro error",
		]);
	});

	it("denyUrls descarta errores cuyo stack pasa por esas URLs", async () => {
		const { client, fetchImpl } = createTestClient({
			denyUrls: [/chrome-extension:/],
		});
		const error = new Error("de una extensión");
		error.stack =
			"Error: x\n    at run (chrome-extension://abc/content.js:1:1)";
		client.captureException(error);
		await client.flush();
		expect(fetchImpl).not.toHaveBeenCalled();
	});

	it("allowUrls solo deja pasar errores con frames en esas URLs", async () => {
		const { client, sent } = createTestClient({
			allowUrls: ["https://app.example.com"],
		});
		const mine = new Error("mío");
		mine.stack = "Error: x\n    at a (https://app.example.com/a.js:1:1)";
		const theirs = new Error("ajeno");
		theirs.stack = "Error: x\n    at a (https://ads.example.net/a.js:1:1)";
		client.captureException(mine);
		client.captureException(theirs);
		await client.flush();
		expect(sent.map((e) => e.exception?.values[0].value)).toEqual(["mío"]);
	});

	it("sampleRate controla qué fracción se envía", async () => {
		const none = createTestClient({ sampleRate: 0 });
		none.client.captureMessage("x");
		await none.client.flush();
		expect(none.fetchImpl).not.toHaveBeenCalled();

		const half = createTestClient({ sampleRate: 0.5 });
		const random = vi.spyOn(Math, "random");
		random.mockReturnValueOnce(0.2).mockReturnValueOnce(0.9);
		half.client.captureMessage("entra");
		half.client.captureMessage("no entra");
		await half.client.flush();
		expect(half.sent.map((e) => e.message)).toEqual(["entra"]);
	});

	it("beforeSend puede modificar o descartar el evento", async () => {
		const { client, sent } = createTestClient({
			beforeSend: (event) => {
				if (event.message === "privado") return null;
				return { ...event, tags: { ...event.tags, revisado: "si" } };
			},
		});
		client.captureMessage("privado");
		client.captureMessage("publico");
		await client.flush();
		expect(sent).toHaveLength(1);
		expect(sent[0].tags).toMatchObject({ revisado: "si" });
	});
});

describe("SentinelClient: deduplicación y límite de ritmo", () => {
	it("el mismo error capturado dos veces seguidas se envía una sola vez", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-10-09T12:00:00Z"));
		const { client, sent } = createTestClient();
		const error = new Error("repetido");
		client.captureException(error);
		client.captureException(error);
		client.captureException(new Error("distinto"));
		vi.advanceTimersByTime(1_500);
		client.captureException(error);
		await vi.runAllTimersAsync();
		expect(sent.map((e) => e.exception?.values[0].value)).toEqual([
			"repetido",
			"distinto",
			"repetido",
		]);
	});

	it("maxEventsPerMinute corta las tormentas de eventos", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-10-09T12:00:00Z"));
		const { client, sent } = createTestClient({ maxEventsPerMinute: 3 });
		for (let i = 0; i < 6; i++) client.captureMessage(`m${i}`);
		await vi.runAllTimersAsync();
		expect(sent).toHaveLength(3);

		// Pasado el minuto, vuelve a enviar.
		vi.advanceTimersByTime(61_000);
		client.captureMessage("despues");
		await vi.runAllTimersAsync();
		expect(sent).toHaveLength(4);
	});
});
