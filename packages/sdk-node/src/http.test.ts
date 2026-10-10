import http from "node:http";
import https from "node:https";
import type { AddressInfo } from "node:net";
import { ingestEventSchema, ingestTransactionSchema } from "@sentinel/shared";
import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NodeClient } from "./client";
import { setClient } from "./hub";
import {
	expressErrorHandler,
	expressRequestHandler,
	setupFastify,
} from "./integrations";
import { normalizePath } from "./route";
import type { NodeOptions } from "./types";

const KEY = "0123456789abcdef0123456789abcdef";
const PROJECT = "48140d16-1ad4-4a8b-b08e-04762f0d78b9";
const DSN = `https://${KEY}@sentinel.example.com/${PROJECT}`;
const TRACE = "4bf92f3577b34da6a3ce929d0e0e4736";
const PARENT = "00f067aa0ba902b7";

type Body = Record<string, unknown>;
const cleanups: Array<() => Promise<unknown> | unknown> = [];
afterEach(async () => {
	for (const c of cleanups.splice(0).reverse()) await c();
	setClient(undefined);
	vi.restoreAllMocks();
});

/** Cliente con tracing y la instrumentación HTTP instalada; el transporte guarda lo que enviaría. */
function boot(options: Partial<NodeOptions> = {}) {
	const bodies: Body[] = [];
	const fetchImpl = vi.fn(async (_url: string, init: { body: string }) => {
		bodies.push(JSON.parse(init.body));
		return new Response(null, { status: 202 });
	});
	const client = new NodeClient(
		{
			dsn: DSN,
			tracesSampleRate: 1,
			captureGlobalErrors: false,
			breadcrumbs: false,
			...options,
		},
		{ fetchImpl: fetchImpl as unknown as typeof fetch, retryDelays: [1] },
	).install();
	setClient(client);
	cleanups.push(() => client.close());
	return {
		client,
		events: () => bodies.filter((b) => !("trace_id" in b)),
		transactions: () => bodies.filter((b) => "trace_id" in b),
		/** Espera a que haya `n` transacciones enviadas (se cierran al terminar la respuesta). */
		async transactionsReady(n: number) {
			await vi.waitFor(() =>
				expect(bodies.filter((b) => "trace_id" in b)).toHaveLength(n),
			);
			await client.flush();
			return bodies.filter((b) => "trace_id" in b);
		},
	};
}

function listen(
	handler: http.RequestListener,
): Promise<{ port: number; server: http.Server }> {
	const server = http.createServer(handler);
	cleanups.push(() => new Promise((resolve) => server.close(resolve)));
	return new Promise((resolve) =>
		server.listen(0, "127.0.0.1", () =>
			resolve({ port: (server.address() as AddressInfo).port, server }),
		),
	);
}

/** Petición con `http` de verdad, para leer estado y cuerpo. */
function get(
	port: number,
	path: string,
	headers: http.OutgoingHttpHeaders = {},
) {
	return new Promise<{ status: number; body: string }>((resolve, reject) => {
		const req = http.request(
			{ host: "127.0.0.1", port, path, headers },
			(res) => {
				let body = "";
				res.on("data", (c) => {
					body += c;
				});
				res.on("end", () => resolve({ status: res.statusCode ?? 0, body }));
			},
		);
		req.on("error", reject);
		req.end();
	});
}

describe("servidor HTTP", () => {
	it("mide cada petición con su ruta sin ids, método, código y duración", async () => {
		const { transactionsReady } = boot();
		const { port } = await listen((_req, res) => res.end("ok"));
		await get(
			port,
			"/users/42/orders/9f1d0c6e-3b52-4a8e-9a47-0d6f1c2b7e11?token=secret",
		);

		const [tx] = await transactionsReady(1);
		expect(ingestTransactionSchema.safeParse(tx).success).toBe(true);
		expect(tx).toMatchObject({
			name: "GET /users/:id/orders/:id",
			op: "http.server",
			status: "ok",
			platform: "node",
			tags: { "http.method": "GET", "http.status_code": "200" },
		});
		expect(JSON.stringify(tx)).not.toContain("secret");
	});

	it("un 5xx es un fallo de la transacción; un 4xx no", async () => {
		const { transactionsReady } = boot();
		const { port } = await listen((req, res) => {
			res.statusCode = req.url === "/boom" ? 500 : 404;
			res.end();
		});
		await get(port, "/boom");
		await get(port, "/missing");
		const txs = await transactionsReady(2);
		const byName = Object.fromEntries(txs.map((t) => [t.name, t.status]));
		expect(byName).toEqual({
			"GET /boom": "internal_error",
			"GET /missing": "ok",
		});
	});

	it("continúa la traza que llega en traceparent", async () => {
		const { transactionsReady } = boot();
		const { port } = await listen((_req, res) => res.end("ok"));
		await get(port, "/x", { traceparent: `00-${TRACE}-${PARENT}-01` });
		const [tx] = await transactionsReady(1);
		expect(tx).toMatchObject({ trace_id: TRACE, parent_span_id: PARENT });
	});

	it("si quien llama decidió no registrar la traza (flag 00), no se envía", async () => {
		const { transactions, client } = boot();
		const { port } = await listen((_req, res) => res.end("ok"));
		await get(port, "/x", { traceparent: `00-${TRACE}-${PARENT}-00` });
		await get(port, "/y");
		await vi.waitFor(() => expect(transactions()).toHaveLength(1));
		await client.flush();
		expect(transactions().map((t) => t.name)).toEqual(["GET /y"]);
	});

	it("las peticiones simultáneas no se mezclan", async () => {
		const { transactionsReady } = boot();
		const { port } = await listen(async (req, res) => {
			const delay = req.url === "/slow" ? 40 : 5;
			await new Promise((r) => setTimeout(r, delay));
			await getClientTrace(req.url ?? "");
			res.end("ok");
		});
		await Promise.all([get(port, "/slow"), get(port, "/fast")]);
		const txs = await transactionsReady(2);
		for (const tx of txs) {
			const spans = tx.spans as Array<{ description: string }>;
			expect(spans.map((s) => s.description)).toEqual([
				`work ${(tx.name as string).slice(4)}`,
			]);
		}
	});

	it("un error capturado durante la petición lleva la petición y su trace_id", async () => {
		const { client, events, transactionsReady } = boot();
		const { port } = await listen((_req, res) => {
			client.captureException(new Error("falló el pago"));
			res.end("ok");
		});
		await get(port, "/pay?card=4242", { "user-agent": "curl/8" });
		const [tx] = await transactionsReady(1);
		await client.flush();

		const [event] = events();
		expect(ingestEventSchema.safeParse(event).success).toBe(true);
		expect(event).toMatchObject({
			request: {
				url: "/pay",
				method: "GET",
				headers: { "User-Agent": "curl/8" },
			},
			contexts: { trace: { trace_id: tx.trace_id } },
		});
		expect(JSON.stringify(event.request)).not.toContain("4242");
	});

	it("transactionName permite elegir el nombre", async () => {
		const { transactionsReady } = boot({
			transactionName: ({ path }) =>
				path.startsWith("/api/") ? "api" : undefined,
		});
		const { port } = await listen((_req, res) => res.end());
		await get(port, "/api/orders");
		await get(port, "/home");
		const names = (await transactionsReady(2)).map((t) => t.name).sort();
		expect(names).toEqual(["GET /home", "api"]);
	});
});

/** Una "consulta" medida dentro de la petición en curso. */
async function getClientTrace(url: string) {
	const { getClient } = await import("./hub");
	await getClient()?.trace(
		"db.query",
		`work ${url}`,
		() => new Promise((r) => setTimeout(r, 5)),
	);
}

describe("peticiones salientes", () => {
	it("http.get dentro de una petición crea un span http.client y propaga traceparent al destino configurado", async () => {
		const received: Array<string | undefined> = [];
		const { transactionsReady } = boot({
			tracePropagationTargets: ["127.0.0.1"],
		});
		const target = await listen((req, res) => {
			received.push(req.headers.traceparent as string | undefined);
			res.end("ok");
		});
		const front = await listen(async (_req, res) => {
			await get(target.port, "/inner?token=abc");
			res.end("ok");
		});
		await get(front.port, "/outer");

		// Una transacción por servidor, ambas en la misma traza: la del destino continúa a la de origen.
		const txs = await transactionsReady(2);
		const outer = txs.find((t) => t.name === "GET /outer") as Body;
		const inner = txs.find((t) => t.name === "GET /inner") as Body;
		expect(inner.trace_id).toBe(outer.trace_id);
		const span = (outer.spans as Array<Record<string, unknown>>)[0];
		expect(span).toMatchObject({
			op: "http.client",
			description: `GET http://127.0.0.1:${target.port}/inner`,
			status: "ok",
			data: { "http.status_code": 200 },
		});
		expect(inner.parent_span_id).toBe(span.span_id);
		expect(received[0]).toBe(`00-${outer.trace_id}-${span.span_id}-01`);
		expect(JSON.stringify(txs)).not.toContain("abc");
	});

	it("por defecto no se envía traceparent a terceros", async () => {
		const received: Array<string | undefined> = [];
		const { transactionsReady } = boot();
		const target = await listen((req, res) => {
			received.push(req.headers.traceparent as string | undefined);
			res.end("ok");
		});
		const front = await listen(async (_req, res) => {
			await get(target.port, "/inner");
			res.end("ok");
		});
		await get(front.port, "/outer");
		const txs = await transactionsReady(2);
		expect(received[0]).toBeUndefined();
		// Sin cabecera, el destino abre su propia traza.
		const [a, b] = txs;
		expect(a.trace_id).not.toBe(b.trace_id);
	});

	it("fetch también se mide, con un span y su estado", async () => {
		const { transactionsReady } = boot();
		const target = await listen((_req, res) => {
			res.statusCode = 503;
			res.end();
		});
		const front = await listen(async (_req, res) => {
			await fetch(`http://127.0.0.1:${target.port}/svc`);
			res.end("ok");
		});
		await get(front.port, "/outer");
		const txs = await transactionsReady(2);
		const outer = txs.find((t) => t.name === "GET /outer") as Body;
		expect((outer.spans as Array<Record<string, unknown>>)[0]).toMatchObject({
			op: "http.client",
			status: "internal_error",
			data: { "http.status_code": 503 },
		});
	});

	it("un fallo de red cierra el span con error y no rompe la petición", async () => {
		const { transactionsReady } = boot();
		const front = await listen(async (_req, res) => {
			await get(1, "/refused").catch(() => undefined);
			res.end("ok");
		});
		expect((await get(front.port, "/outer")).status).toBe(200);
		const [tx] = await transactionsReady(1);
		expect((tx.spans as Array<Record<string, unknown>>)[0].status).toBe(
			"internal_error",
		);
	});

	it("al cerrar el cliente se restauran http y fetch", async () => {
		const emit = http.Server.prototype.emit;
		const request = http.request;
		const fetchBefore = globalThis.fetch;
		const { client } = boot();
		expect(http.Server.prototype.emit).not.toBe(emit);
		expect(http.request).not.toBe(request);
		await client.close();
		expect(http.Server.prototype.emit).toBe(emit);
		expect(http.request).toBe(request);
		expect(globalThis.fetch).toBe(fetchBefore);
	});

	it("las peticiones del propio SDK no generan spans", async () => {
		const { client } = boot();
		const tx = client.startTransaction({ name: "manual" });
		const req = https.get(
			`https://sentinel.example.com/api/${PROJECT}/transactions`,
			() => {},
		);
		req.on("error", () => {});
		req.destroy();
		tx?.finish();
		expect(tx?.spans).toHaveLength(0);
	});
});

describe("integraciones", () => {
	it("Fastify: nombra la transacción con la ruta registrada y captura los errores 5xx", async () => {
		const { events, client, transactionsReady } = boot();
		const app = Fastify();
		setupFastify(app);
		app.get("/users/:id", async () => "ok");
		app.get("/boom", async () => {
			throw new Error("explotó");
		});
		await app.listen({ port: 0, host: "127.0.0.1" });
		cleanups.push(() => app.close());
		const port = (app.server.address() as AddressInfo).port;

		await get(port, "/users/42");
		await get(port, "/boom");
		const txs = await transactionsReady(2);
		expect(txs.map((t) => t.name).sort()).toEqual([
			"GET /boom",
			"GET /users/:id",
		]);
		await client.flush();
		expect(events()).toHaveLength(1);
		expect(events()[0]).toMatchObject({
			tags: { mechanism: "fastify", handled: "true" },
			exception: { values: [{ value: "explotó" }] },
		});
	});

	it("Express: el manejador de errores captura y pasa el error; ignora los 4xx", async () => {
		const { events, client } = boot();
		const handler = expressErrorHandler();
		const next = vi.fn();
		const err = new Error("boom");
		handler(err, { method: "GET" }, {}, next);
		handler(
			Object.assign(new Error("no existe"), { status: 404 }),
			{ method: "GET" },
			{},
			next,
		);
		await client.flush();
		expect(events()).toHaveLength(1);
		expect(next).toHaveBeenCalledTimes(2);
		expect(next).toHaveBeenCalledWith(err);
	});

	it("Express: nombra la transacción con la ruta al terminar la respuesta", async () => {
		const { client, transactionsReady } = boot();
		const handler = expressRequestHandler();
		const { port } = await listen((req, res) => {
			// Simula lo que hace Express al resolver la ruta.
			const expressReq = Object.assign(req, {
				baseUrl: "/api",
				route: { path: "/users/:id" },
			});
			handler(expressReq as never, res as never, () => res.end("ok"));
		});
		await get(port, "/api/users/42");
		const [tx] = await transactionsReady(1);
		expect(tx.name).toBe("GET /api/users/:id");
		void client;
	});
});

describe("normalizePath", () => {
	it("sustituye ids numéricos, UUID y hexadecimales largos", () => {
		expect(
			normalizePath("/users/42/orders/9f1d0c6e-3b52-4a8e-9a47-0d6f1c2b7e11"),
		).toBe("/users/:id/orders/:id");
		expect(normalizePath("/files/4bf92f3577b34da6a3ce929d0e0e4736")).toBe(
			"/files/:id",
		);
		expect(normalizePath("/health")).toBe("/health");
		expect(normalizePath("/")).toBe("/");
		expect(normalizePath("")).toBe("/");
	});
});
