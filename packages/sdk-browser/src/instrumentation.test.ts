import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SentinelClient } from "./client";
import { describeElement } from "./instrumentation/clicks";
import { createTestClient, ENDPOINT } from "./test-utils";

let active: SentinelClient | undefined;
const originals = {
	fetch: window.fetch,
	log: console.log,
	pushState: history.pushState,
};

function boot(options = {}) {
	const t = createTestClient({ maxEventsPerMinute: 1_000, ...options });
	active = t.client.install();
	return t;
}

// jsdom/Vitest tratan un ErrorEvent sin preventDefault como "error no manejado" y
// hacen fallar la ejecución. Estos tests simulan errores de la app a propósito.
const swallowWindowErrors = (event: Event) => event.preventDefault();

beforeEach(() => {
	window.addEventListener("error", swallowWindowErrors);
	window.fetch = vi.fn(
		async () => new Response("ok", { status: 200 }),
	) as unknown as typeof fetch;
});

afterEach(async () => {
	window.removeEventListener("error", swallowWindowErrors);
	await active?.close();
	active = undefined;
	document.body.innerHTML = "";
	history.replaceState({}, "", "/");
	window.fetch = originals.fetch;
	vi.restoreAllMocks();
});

describe("errores globales", () => {
	it("captura window.onerror con el error y lo marca como no manejado", async () => {
		const { sent, client } = boot();
		const error = new Error("explotó");
		window.dispatchEvent(
			new ErrorEvent("error", { error, message: "explotó" }),
		);
		await client.flush();
		expect(sent).toHaveLength(1);
		expect(sent[0].exception?.values[0]).toMatchObject({
			type: "Error",
			value: "explotó",
		});
		expect(sent[0].tags).toMatchObject({
			handled: "false",
			mechanism: "onerror",
		});
	});

	it("un error sin objeto Error (cross-origin) se reconstruye con mensaje y ubicación", async () => {
		const { sent, client } = boot();
		window.dispatchEvent(
			new ErrorEvent("error", {
				message: "Uncaught Boom",
				filename: "http://localhost:3000/app.js",
				lineno: 12,
				colno: 4,
			}),
		);
		await client.flush();
		expect(
			sent[0].exception?.values[0].stacktrace?.frames.at(-1),
		).toMatchObject({
			filename: "http://localhost:3000/app.js",
			lineno: 12,
			colno: 4,
		});
	});

	it("captura unhandledrejection, también con valores que no son Error", async () => {
		const { sent, client } = boot();
		const event = new Event("unhandledrejection");
		Object.assign(event, { reason: "rechazada" });
		window.dispatchEvent(event);
		const withError = new Event("unhandledrejection");
		Object.assign(withError, { reason: new RangeError("fuera de rango") });
		window.dispatchEvent(withError);
		await client.flush();

		expect(sent[0].exception?.values[0]).toEqual({
			type: "UnhandledRejection",
			value: "Non-Error promise rejection captured with value: rechazada",
		});
		expect(sent[1].exception?.values[0]).toMatchObject({ type: "RangeError" });
		expect(sent[1].tags).toMatchObject({ mechanism: "onunhandledrejection" });
	});

	it("un recurso que falla al cargar es un breadcrumb, no un evento", async () => {
		const { sent, client } = boot();
		const img = document.createElement("img");
		img.src = "http://localhost:3000/no-existe.png";
		document.body.append(img);
		img.dispatchEvent(new Event("error"));
		client.captureMessage("despues");
		await client.flush();

		expect(sent).toHaveLength(1);
		expect(sent[0].breadcrumbs).toEqual([
			expect.objectContaining({
				category: "resource",
				message: "Failed to load <img>",
			}),
		]);
	});

	it("captureGlobalErrors: false no engancha los handlers", async () => {
		const { sent, client } = boot({ captureGlobalErrors: false });
		window.dispatchEvent(
			new ErrorEvent("error", { error: new Error("x"), message: "x" }),
		);
		await client.flush();
		expect(sent).toHaveLength(0);
	});
});

describe("breadcrumbs automáticos", () => {
	it("console: registra con su nivel y sigue llamando a la consola original", async () => {
		const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
		const { sent, client } = boot();
		console.warn("cuidado", { a: 1 });
		client.captureMessage("x");
		await client.flush();

		expect(spy).toHaveBeenCalledWith("cuidado", { a: 1 });
		expect(sent[0].breadcrumbs).toEqual([
			expect.objectContaining({
				category: "console",
				level: "warning",
				message: 'cuidado {"a":1}',
			}),
		]);
	});

	it("clicks: registra solo el selector, nunca el texto", async () => {
		const { sent, client } = boot();
		document.body.innerHTML =
			'<main id="app"><form><button class="btn primary">Pagar 4111-1111</button></form></main>';
		document.querySelector("button")?.click();
		client.captureMessage("x");
		await client.flush();

		const crumb = sent[0].breadcrumbs?.find((b) => b.category === "ui.click");
		expect(crumb?.message).toBe("main#app > form > button.btn.primary");
		expect(JSON.stringify(sent[0])).not.toContain("4111");
	});

	it("fetch: registra método, URL sin query, estado y duración; las peticiones del SDK no", async () => {
		const { sent, client } = boot();
		await window.fetch("https://api.otro.com/users?token=secreto", {
			method: "post",
		});
		await window.fetch(`${ENDPOINT}`, { method: "POST" });
		client.captureMessage("x");
		await client.flush();

		const crumbs =
			sent[0].breadcrumbs?.filter((b) => b.category === "fetch") ?? [];
		expect(crumbs).toHaveLength(1);
		expect(crumbs[0]).toMatchObject({
			type: "http",
			level: "info",
			data: {
				method: "POST",
				url: "https://api.otro.com/users",
				status_code: 200,
			},
		});
		expect(typeof crumbs[0].data?.duration_ms).toBe("number");
		expect(JSON.stringify(sent[0])).not.toContain("secreto");
	});

	it("fetch: un 500 es warning y un fallo de red se registra sin alterar el rechazo", async () => {
		window.fetch = vi
			.fn()
			.mockResolvedValueOnce(new Response("no", { status: 500 }))
			.mockRejectedValueOnce(
				new TypeError("Failed to fetch"),
			) as unknown as typeof fetch;
		const { sent, client } = boot();
		await window.fetch("/a");
		await expect(window.fetch("/b")).rejects.toThrow("Failed to fetch");
		client.captureMessage("x");
		await client.flush();

		const crumbs =
			sent[0].breadcrumbs?.filter((b) => b.category === "fetch") ?? [];
		expect(crumbs[0]).toMatchObject({
			level: "warning",
			data: { status_code: 500 },
		});
		expect(crumbs[1]).toMatchObject({
			level: "error",
			data: { error: "Failed to fetch" },
		});
	});

	it("navegación: pushState y popstate registran from/to sin query", async () => {
		const { sent, client } = boot();
		history.pushState({}, "", "/productos?orden=precio");
		history.pushState({}, "", "/carrito");
		client.captureMessage("x");
		await client.flush();

		const crumbs =
			sent[0].breadcrumbs?.filter((b) => b.category === "navigation") ?? [];
		expect(crumbs.map((c) => c.data)).toEqual([
			{ from: "http://localhost:3000/", to: "http://localhost:3000/productos" },
			{
				from: "http://localhost:3000/productos",
				to: "http://localhost:3000/carrito",
			},
		]);
	});

	it("breadcrumbs: false o por tipo desactiva la instrumentación correspondiente", async () => {
		const off = boot({ breadcrumbs: false });
		console.info("no se registra");
		off.client.captureMessage("x");
		await off.client.flush();
		expect(off.sent[0].breadcrumbs).toBeUndefined();
		await active?.close();

		const partial = boot({ breadcrumbs: { console: false } });
		console.info("tampoco");
		document.body.innerHTML = "<button>ok</button>";
		document.querySelector("button")?.click();
		partial.client.captureMessage("x");
		await partial.client.flush();
		expect(partial.sent[0].breadcrumbs?.map((b) => b.category)).toEqual([
			"ui.click",
		]);
	});
});

describe("close()", () => {
	it("restaura consola, fetch e historial y deja de capturar", async () => {
		const spy = vi.spyOn(console, "log").mockImplementation(() => {});
		const fetchBefore = window.fetch;
		const pushBefore = history.pushState;
		const { client, sent } = boot();

		expect(window.fetch).not.toBe(fetchBefore);
		await client.close();
		active = undefined;

		expect(window.fetch).toBe(fetchBefore);
		expect(history.pushState).toBe(pushBefore);
		expect(console.log).toBe(spy);

		window.dispatchEvent(
			new ErrorEvent("error", { error: new Error("tarde"), message: "tarde" }),
		);
		expect(sent).toHaveLength(0);
	});
});

describe("describeElement", () => {
	it("corta en el primer id y limita la profundidad y las clases", () => {
		document.body.innerHTML =
			'<div id="root"><section><div><ul><li class="a b c d e"><span>x</span></li></ul></div></section></div>';
		expect(describeElement(document.querySelector("span") as Element)).toBe(
			"ul > li.a.b.c > span",
		);
		expect(describeElement(document.querySelector("section") as Element)).toBe(
			"div#root > section",
		);
	});
});
