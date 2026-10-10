import { errorResponseSchema, ingestResponseSchema } from "@sentinel/shared";
import { describe, expect, it } from "vitest";
import { scalar } from "../support/db.js";
import { eventually } from "../support/eventually.js";
import { createTenant, minutesAgo, transaction } from "../support/factories.js";

const count = (table: string, projectId: string) =>
	scalar(
		`select count(*) from ${table} where ${table === "perf_span" ? "transaction_id in (select id from perf_transaction where project_id = $1)" : "project_id = $1"}`,
		[projectId],
	);

describe("ingesta de transacciones", () => {
	it("acepta con 202, guarda la transacción con sus spans y sus medidas", async () => {
		const t = await createTenant();
		const res = await t.client.ingestTransaction(
			t.projectId,
			t.key,
			transaction({
				name: "/cart",
				durationMs: 2500,
				timestamp: minutesAgo(10),
				user: "u1",
				measurements: { lcp: { value: 1800, unit: "millisecond" } },
			}),
		);
		expect(res.status).toBe(202);
		const { id } = ingestResponseSchema.parse(res.json);

		await eventually(async () =>
			expect(await count("perf_transaction", t.projectId)).toBe(1),
		);
		expect(await count("perf_span", t.projectId)).toBe(1);
		expect(
			await scalar(
				"select duration_ms from perf_transaction where id = $1 and name = '/cart' and user_identifier = 'u1'",
				[id],
			),
		).toBe(2500);
		expect(
			await scalar(
				"select (measurements->'lcp'->>'value')::float from perf_transaction where id = $1",
				[id],
			),
		).toBe(1800);
	});

	it("un reenvío con el mismo transaction_id no se duplica", async () => {
		const t = await createTenant();
		const body = transaction({
			transactionId: "9f1d0c6e-3b52-4a8e-9a47-0d6f1c2b7e11",
		});
		expect(
			(await t.client.ingestTransaction(t.projectId, t.key, body)).status,
		).toBe(202);
		await eventually(async () =>
			expect(await count("perf_transaction", t.projectId)).toBe(1),
		);
		expect(
			(await t.client.ingestTransaction(t.projectId, t.key, body)).status,
		).toBe(202);
		await new Promise((r) => setTimeout(r, 400));
		expect(await count("perf_transaction", t.projectId)).toBe(1);
		expect(await count("perf_span", t.projectId)).toBe(1);
	});

	it("los secretos de la descripción de un span se filtran antes de guardar", async () => {
		const t = await createTenant();
		await t.client.ingestTransaction(
			t.projectId,
			t.key,
			transaction({
				spans: [
					{
						span_id: "b9c7c989f97918e1",
						op: "http.client",
						description: "GET https://api.example.com/x?token=abc123secret",
						start_timestamp: minutesAgo(5),
						duration_ms: 20,
						data: { authorization: "Bearer topsecret" },
					},
				],
			}),
		);
		await eventually(async () =>
			expect(await count("perf_span", t.projectId)).toBe(1),
		);
		expect(
			await scalar(
				"select count(*) from perf_span where description like '%abc123secret%' or data::text like '%topsecret%'",
			),
		).toBe(0);
	});

	it("sin clave o con una inválida se rechaza; payload inválido: 400", async () => {
		const t = await createTenant();
		// Si otro test de la suite ya bloqueó las claves inválidas de esta IP, responde 429 en lugar de 401.
		for (const key of [undefined, "0".repeat(32)]) {
			const res = await t.client.ingestTransaction(
				t.projectId,
				key,
				transaction(),
			);
			expect([401, 429]).toContain(res.status);
		}

		for (const bad of [
			{ ...transaction(), trace_id: "no-es-hex" },
			{ ...transaction(), duration_ms: -5 },
			{ ...transaction(), name: "" },
			{ ...transaction(), spans: [{ op: "x" }] },
		]) {
			const res = await t.client.ingestTransaction(t.projectId, t.key, bad);
			expect(res.status).toBe(400);
			expect(errorResponseSchema.parse(res.json).statusCode).toBe(400);
		}
		await new Promise((r) => setTimeout(r, 300));
		expect(await count("perf_transaction", t.projectId)).toBe(0);
	});

	it("la ruta de transacciones tiene CORS abierto, como la de eventos", async () => {
		const t = await createTenant();
		const res = await t.client.request(`/api/${t.projectId}/transactions`, {
			method: "OPTIONS",
			origin: "https://cliente.example.com",
			headers: {
				"Access-Control-Request-Method": "POST",
				"Access-Control-Request-Headers": "content-type,x-sentinel-key",
			},
		});
		expect(res.headers.get("access-control-allow-origin")).toBe("*");
	});
});
