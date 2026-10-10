import { ingestEventSchema, ingestTransactionSchema } from "@sentinel/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NodeClient } from "./client";
import type { NodeOptions } from "./types";

const KEY = "0123456789abcdef0123456789abcdef";
const PROJECT = "48140d16-1ad4-4a8b-b08e-04762f0d78b9";
const DSN = `https://${KEY}@api.example.com/${PROJECT}`;

function setup(options: Partial<NodeOptions> = {}) {
	const bodies: Array<Record<string, unknown>> = [];
	const fetchImpl = vi.fn(async (_url: string, init: { body: string }) => {
		bodies.push(JSON.parse(init.body));
		return new Response(null, { status: 202 });
	});
	const client = new NodeClient(
		{ dsn: DSN, captureGlobalErrors: false, breadcrumbs: false, ...options },
		{ fetchImpl: fetchImpl as unknown as typeof fetch, retryDelays: [1] },
	);
	return {
		client,
		events: () => bodies.filter((b) => !("trace_id" in b)),
		transactions: () => bodies.filter((b) => "trace_id" in b),
	};
}

const clients: NodeClient[] = [];
afterEach(async () => {
	await Promise.all(clients.splice(0).map((c) => c.close()));
	vi.restoreAllMocks();
});

describe("NodeClient: eventos", () => {
	it("captureException envía un evento válido de plataforma node, con runtime y SO", async () => {
		const { client, events } = setup({ release: "1.2.3", environment: "prod" });
		clients.push(client);
		client.setUser({ id: "u1" });
		client.setTag("feature", "billing");
		const id = client.captureException(new TypeError("boom"));
		await client.flush();

		const [event] = events();
		const parsed = ingestEventSchema.safeParse(event);
		expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
		expect(event).toMatchObject({
			event_id: id,
			platform: "node",
			level: "error",
			release: "1.2.3",
			environment: "prod",
			user: { id: "u1" },
			tags: { feature: "billing" },
			contexts: {
				sdk: { name: "sentinel.javascript.node" },
				runtime: { name: "node", version: process.version },
			},
		});
	});

	it("los frames distinguen el código propio de node_modules y de los módulos internos de Node", async () => {
		const { client, events } = setup();
		clients.push(client);
		const error = new Error("x");
		error.stack = [
			"Error: x",
			"    at handler (/srv/app/dist/routes/orders.js:42:11)",
			"    at Layer.handle [as handle_request] (/srv/app/node_modules/express/lib/router/layer.js:95:5)",
			"    at process.processTicksAndRejections (node:internal/process/task_queues:95:5)",
		].join("\n");
		client.captureException(error);
		await client.flush();

		const frames = (
			events()[0].exception as {
				values: Array<{
					stacktrace: { frames: Array<{ filename: string; in_app: boolean }> };
				}>;
			}
		).values[0].stacktrace.frames;
		// Del más antiguo al más reciente: el último es donde se lanzó.
		expect(frames.map((f) => [f.filename.split("/").pop(), f.in_app])).toEqual([
			["task_queues:95:5".split(":")[0], false],
			["layer.js", false],
			["orders.js", true],
		]);
	});

	it("con una DSN inválida el SDK queda desactivado y no lanza", () => {
		const { client } = setup({ dsn: "nope" });
		expect(client.enabled).toBe(false);
		expect(client.captureException(new Error("x"))).toBeUndefined();
	});
});

describe("NodeClient: rendimiento", () => {
	it("runTransaction aísla las transacciones de peticiones concurrentes", async () => {
		const { client, transactions } = setup({ tracesSampleRate: 1 });
		clients.push(client);
		const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

		const handle = (name: string, delay: number) =>
			client.runTransaction({ name, op: "http.server" }, async (tx) => {
				await sleep(delay);
				await client.trace("db.query", `query de ${name}`, () => sleep(5));
				tx.finish();
			});
		await Promise.all([handle("GET /a", 20), handle("GET /b", 5)]);
		await client.flush();

		const byName = Object.fromEntries(
			transactions().map((t) => [t.name as string, t]),
		);
		expect(Object.keys(byName).sort()).toEqual(["GET /a", "GET /b"]);
		for (const [name, tx] of Object.entries(byName)) {
			expect(ingestTransactionSchema.safeParse(tx).success).toBe(true);
			const spans = tx.spans as Array<{ description: string }>;
			expect(spans.map((s) => s.description)).toEqual([`query de ${name}`]);
		}
		expect(byName["GET /a"].trace_id).not.toBe(byName["GET /b"].trace_id);
	});

	it("una transacción que continúa una traza externa lleva su parent_span_id", async () => {
		const { client, transactions } = setup({ tracesSampleRate: 1 });
		clients.push(client);
		client.runTransaction(
			{
				name: "GET /x",
				traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
				parentSpanId: "00f067aa0ba902b7",
			},
			(tx) => tx.finish(),
		);
		await client.flush();
		expect(transactions()[0]).toMatchObject({
			trace_id: "4bf92f3577b34da6a3ce929d0e0e4736",
			parent_span_id: "00f067aa0ba902b7",
			platform: "node",
		});
	});

	it("los errores capturados dentro de una transacción llevan su trace_id", async () => {
		const { client, events } = setup({ tracesSampleRate: 1 });
		clients.push(client);
		const traceId = client.runTransaction({ name: "t" }, (tx) => {
			client.captureException(new Error("dentro"));
			tx.finish();
			return tx.traceId;
		});
		client.captureException(new Error("fuera"));
		await client.flush();
		const trace = (e: Record<string, unknown>) =>
			(e.contexts as { trace?: { trace_id: string } }).trace?.trace_id;
		expect(trace(events()[0])).toBe(traceId);
		expect(trace(events()[1])).toBeUndefined();
	});

	it("sin tracesSampleRate no se mide nada", async () => {
		const { client, transactions } = setup();
		clients.push(client);
		client.runTransaction({ name: "t" }, (tx) => tx.finish());
		await client.flush();
		expect(transactions()).toHaveLength(0);
	});
});
