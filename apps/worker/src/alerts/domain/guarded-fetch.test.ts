import { createServer, type Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DeliveryError } from "./delivery-error.js";
import { guardedFetch } from "./guarded-fetch.js";

let server: Server;
let base: string;
let requests: Array<{
	method?: string;
	url?: string;
	headers: Record<string, unknown>;
	body: string;
}>;
let respond: (url: string) => {
	status: number;
	headers?: Record<string, string>;
};

beforeEach(async () => {
	requests = [];
	respond = () => ({ status: 200 });
	server = createServer((req, res) => {
		const chunks: Buffer[] = [];
		req.on("data", (c) => chunks.push(c));
		req.on("end", () => {
			requests.push({
				method: req.method,
				url: req.url,
				headers: req.headers,
				body: Buffer.concat(chunks).toString(),
			});
			const { status, headers } = respond(req.url ?? "");
			res.writeHead(status, headers);
			res.end("ok");
		});
	});
	await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
	base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
afterEach(() => new Promise<void>((r) => server.close(() => r())));

const post = (url: string, allowPrivate = true, extra = {}) =>
	guardedFetch(url, {
		method: "POST",
		headers: { "Content-Type": "application/json", "X-Test": "1" },
		body: '{"a":1}',
		allowPrivate,
		...extra,
	});

describe("guardedFetch", () => {
	it("envía el método, las cabeceras y el cuerpo, y devuelve el estado", async () => {
		const result = await post(`${base}/hook`);
		expect(result.status).toBe(200);
		expect(requests[0]).toMatchObject({
			method: "POST",
			url: "/hook",
			body: '{"a":1}',
		});
		expect(requests[0].headers["x-test"]).toBe("1");
	});

	it("devuelve el estado de error sin lanzar (quien llama decide si reintenta)", async () => {
		respond = () => ({ status: 503 });
		expect((await post(`${base}/x`)).status).toBe(503);
	});

	it("no sigue redirecciones", async () => {
		respond = (url) =>
			url === "/start"
				? { status: 302, headers: { Location: "/other" } }
				: { status: 200 };
		const result = await post(`${base}/start`);
		expect(result.status).toBe(302);
		expect(requests).toHaveLength(1);
	});

	it("rechaza direcciones privadas, de forma permanente, cuando no se permiten", async () => {
		const error = await post(`${base}/x`, false).catch((e) => e);
		expect(error).toBeInstanceOf(DeliveryError);
		expect(error.permanent).toBe(true);
		expect(requests).toHaveLength(0);
	});

	it("rechaza un nombre que resuelve a una dirección privada (localhost) y URLs inválidas", async () => {
		const port = new URL(base).port;
		for (const url of [
			`http://localhost:${port}/x`,
			"ftp://example.com",
			"no es una url",
			"http://169.254.169.254/latest",
		]) {
			const error = await post(url, false).catch((e) => e);
			expect(error, url).toBeInstanceOf(DeliveryError);
			expect(error.permanent, url).toBe(true);
		}
		expect(requests).toHaveLength(0);
	});

	it("un servidor que no responde a tiempo falla como error reintentable", async () => {
		respond = () => ({ status: 200 });
		server.removeAllListeners("request");
		server.on("request", () => {
			/* nunca responde */
		});
		const error = await post(`${base}/slow`, true, { timeoutMs: 100 }).catch(
			(e) => e,
		);
		expect(error).toBeInstanceOf(DeliveryError);
		expect(error.permanent).toBe(false);
		expect(error.message).toMatch(/timed out/);
	});

	it("un host que no existe falla como error reintentable", async () => {
		const error = await post("http://no-existe.invalid/x", false).catch(
			(e) => e,
		);
		expect(error).toBeInstanceOf(DeliveryError);
		expect(error.permanent).toBe(false);
	});
});
