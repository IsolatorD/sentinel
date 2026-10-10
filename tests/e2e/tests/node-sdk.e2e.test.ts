import http from "node:http";
import type { AddressInfo } from "node:net";
import { SentinelClient } from "@sentinel/node";
import { afterEach, describe, expect, it } from "vitest";
import { scalar } from "../support/db.js";
import { eventually } from "../support/eventually.js";
import { createTenant, type Tenant } from "../support/factories.js";

// El SDK de Node real enviando a la API real, procesado por el worker real.
const TRACE = "4bf92f3577b34da6a3ce929d0e0e4736";
const PARENT = "00f067aa0ba902b7";

const cleanups: Array<() => Promise<unknown> | unknown> = [];
afterEach(async () => {
	for (const c of cleanups.splice(0).reverse()) await c();
});

function newClient(
	t: Tenant,
	options: ConstructorParameters<typeof SentinelClient>[0] extends infer O
		? Partial<O>
		: never = {},
) {
	const client = new SentinelClient({
		dsn: t.dsn,
		captureGlobalErrors: false,
		breadcrumbs: false,
		...options,
	}).install();
	cleanups.push(() => client.close());
	return client;
}

const count = (sql: string, params: unknown[]) => scalar(sql, params);

describe("SDK de Node contra la API real", () => {
	it("captureException llega como issue de plataforma node, con su stacktrace en el código propio", async () => {
		const t = await createTenant();
		const sdk = newClient(t, { release: "3.1.0", environment: "e2e" });
		sdk.captureException(new RangeError("fuera de rango"));
		await sdk.flush();

		await eventually(async () =>
			expect(
				(await t.client.get(`${t.projectPath}/issues?status=all`, t.owner)).json
					.items,
			).toHaveLength(1),
		);
		expect(
			await count(
				"select count(*) from event where project_id = $1 and platform = 'node' and release = '3.1.0'",
				[t.projectId],
			),
		).toBe(1);
		// El stack de este archivo (código propio) se marca como in_app.
		expect(
			await count(
				"select count(*) from event where project_id = $1 and payload::text like '%node-sdk.e2e.test%' and payload::text like '%\"in_app\": true%'",
				[t.projectId],
			),
		).toBe(1);
	});

	it("mide las peticiones del servidor y continúa la traza que llega de fuera", async () => {
		const t = await createTenant();
		const sdk = newClient(t, { release: "3.1.0", tracesSampleRate: 1 });
		const server = http.createServer(async (_req, res) => {
			await sdk.trace(
				"db.query",
				"buscar pedido",
				() => new Promise((r) => setTimeout(r, 10)),
			);
			res.end("ok");
		});
		await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
		cleanups.push(() => new Promise((r) => server.close(r)));
		const port = (server.address() as AddressInfo).port;

		await fetch(`http://127.0.0.1:${port}/orders/1234`, {
			headers: { traceparent: `00-${TRACE}-${PARENT}-01` },
		});
		await sdk.flush();

		await eventually(async () =>
			expect(
				await count(
					"select count(*) from perf_transaction where project_id = $1 and name = 'GET /orders/:id' and op = 'http.server' and trace_id = $2 and parent_span_id = $3 and platform = 'node'",
					[t.projectId, TRACE, PARENT],
				),
			).toBe(1),
		);
		expect(
			await count(
				"select count(*) from perf_span s join perf_transaction x on x.id = s.transaction_id where x.project_id = $1 and s.op = 'db.query' and s.description = 'buscar pedido'",
				[t.projectId],
			),
		).toBe(1);

		// Y aparece en la API de rendimiento como una transacción más.
		const list = (
			await t.client.get(`${t.projectPath}/performance/transactions`, t.owner)
		).json;
		expect(list.items.map((i: { name: string }) => i.name)).toEqual([
			"GET /orders/:id",
		]);
	});

	it("un error durante una petición queda enlazado a su traza", async () => {
		const t = await createTenant();
		const sdk = newClient(t, { tracesSampleRate: 1 });
		const server = http.createServer((_req, res) => {
			sdk.captureException(new Error("falló el cobro"));
			res.statusCode = 500;
			res.end();
		});
		await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
		cleanups.push(() => new Promise((r) => server.close(r)));
		await fetch(
			`http://127.0.0.1:${(server.address() as AddressInfo).port}/pay`,
		);
		await sdk.flush();

		await eventually(async () => {
			expect(
				await count(
					"select count(*) from event e join perf_transaction x on x.trace_id = e.payload->'contexts'->'trace'->>'trace_id' where e.project_id = $1 and x.project_id = $1 and x.status = 'internal_error'",
					[t.projectId],
				),
			).toBe(1);
		});
	});
});
