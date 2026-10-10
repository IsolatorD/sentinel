import {
	errorResponseSchema,
	performanceOverviewDtoSchema,
	sampleDetailDtoSchema,
	sampleListDtoSchema,
	transactionListDtoSchema,
} from "@sentinel/shared";
import { describe, expect, it } from "vitest";
import { scalar } from "../support/db.js";
import { eventually } from "../support/eventually.js";
import {
	createTenant,
	minutesAgo,
	type Tenant,
	transaction,
} from "../support/factories.js";

const SPAN_A = "b9c7c989f97918e1";
const SPAN_B = "a1a1a1a1a1a1a1a1";

/**
 * /checkout: 10 transacciones de 100 a 1000 ms (p50 = 550), la última con error.
 * /home: 2 transacciones de 50 ms. Todas con LCP; /checkout además con CLS.
 */
async function seed(t: Tenant) {
	const send = (body: unknown) =>
		t.client.ingestTransaction(t.projectId, t.key, body);
	for (let i = 1; i <= 10; i++) {
		await send(
			transaction({
				name: "/checkout",
				durationMs: i * 100,
				timestamp: minutesAgo(30 - i),
				status: i === 10 ? "internal_error" : "ok",
				user: `u${i % 3}`,
				measurements: {
					lcp: { value: i * 400, unit: "millisecond" },
					cls: { value: 0.3 },
				},
				spans:
					i === 10
						? [
								{
									span_id: SPAN_A,
									parent_span_id: "00f067aa0ba902b7",
									op: "http.client",
									description: "GET /api/cart",
									start_timestamp: minutesAgo(21),
									duration_ms: 300,
								},
								{
									span_id: SPAN_B,
									parent_span_id: SPAN_A,
									op: "db.query",
									description: "select 1",
									start_timestamp: minutesAgo(21),
									duration_ms: 50,
								},
							]
						: [],
			}),
		);
	}
	for (let i = 0; i < 2; i++)
		await send(
			transaction({
				name: "/home",
				durationMs: 50,
				timestamp: minutesAgo(10),
				environment: "staging",
				measurements: { lcp: { value: 500, unit: "millisecond" } },
			}),
		);
	await eventually(async () =>
		expect(
			await scalar(
				"select count(*) from perf_transaction where project_id = $1",
				[t.projectId],
			),
		).toBe(12),
	);
	return `${t.projectPath}/performance`;
}

describe("API de rendimiento", () => {
	it("lista las transacciones agrupadas con percentiles, errores y throughput", async () => {
		const t = await createTenant();
		const base = await seed(t);

		const res = await t.client.get(`${base}/transactions`, t.owner);
		expect(res.status).toBe(200);
		const list = transactionListDtoSchema.parse(res.json);
		expect(list.total).toBe(2);
		const [checkout, home] = list.items; // por defecto, ordenadas por número de ocurrencias
		expect(checkout).toMatchObject({ name: "/checkout", count: 10, p50: 550 });
		expect(checkout.p95).toBeCloseTo(955, 0);
		expect(checkout.errorRate).toBeCloseTo(0.1);
		expect(checkout.tpm).toBeCloseTo(10 / 1440, 5);
		expect(home).toMatchObject({
			name: "/home",
			count: 2,
			p50: 50,
			errorRate: 0,
		});
	});

	it("ordena, busca, pagina y filtra por entorno", async () => {
		const t = await createTenant();
		const base = await seed(t);
		const names = async (query: string) =>
			transactionListDtoSchema
				.parse(
					(await t.client.get(`${base}/transactions?${query}`, t.owner)).json,
				)
				.items.map((i) => i.name);

		expect(await names("sort=p95&order=asc")).toEqual(["/home", "/checkout"]);
		expect(await names("sort=errorRate")).toEqual(["/checkout", "/home"]);
		expect(await names("q=HOME")).toEqual(["/home"]);
		expect(await names("environment=staging")).toEqual(["/home"]);
		expect(await names("release=9.9.9")).toEqual([]);
		expect(await names("limit=1&offset=1")).toEqual(["/home"]);

		const past = transactionListDtoSchema.parse(
			(await t.client.get(`${base}/transactions?limit=1&offset=5`, t.owner))
				.json,
		);
		expect(past.items).toEqual([]);
		expect(past.total).toBe(2);
	});

	it("overview: resumen, serie continua y Web Vitals valorados", async () => {
		const t = await createTenant();
		const base = await seed(t);
		const res = await t.client.get(`${base}/overview?period=24h`, t.owner);
		const o = performanceOverviewDtoSchema.parse(res.json);

		expect(o.summary.count).toBe(12);
		expect(o.points).toHaveLength(24);
		expect(o.points.reduce((n, p) => n + p.count, 0)).toBe(12);
		expect(o.points.reduce((n, p) => n + p.errors, 0)).toBe(1);
		expect(o.points.some((p) => p.count === 0 && p.p95 === null)).toBe(true);
		expect(o.vitals.lcp?.samples).toBe(12);
		expect(o.vitals.cls).toMatchObject({ samples: 10, rating: "poor" });
		expect(o.vitals.inp).toBeUndefined();

		const only = performanceOverviewDtoSchema.parse(
			(await t.client.get(`${base}/overview?name=/home`, t.owner)).json,
		);
		expect(only.summary).toMatchObject({ count: 2, p50: 50, errorRate: 0 });
		expect(only.vitals.cls).toBeUndefined();
	});

	it("samples: las más lentas y las más recientes", async () => {
		const t = await createTenant();
		const base = await seed(t);
		const get = async (q: string) =>
			sampleListDtoSchema.parse(
				(await t.client.get(`${base}/samples?name=/checkout&${q}`, t.owner))
					.json,
			).items;

		const slowest = await get("sort=slowest&limit=3");
		expect(slowest.map((s) => s.durationMs)).toEqual([1000, 900, 800]);
		expect(slowest[0].status).toBe("internal_error");
		const recent = await get("sort=recent&limit=2");
		expect(recent.map((s) => s.durationMs)).toEqual([1000, 900]);
		expect((await t.client.get(`${base}/samples`, t.owner)).status).toBe(400);
	});

	it("detalle de una muestra con la cascada de spans", async () => {
		const t = await createTenant();
		const base = await seed(t);
		const [slowest] = sampleListDtoSchema.parse(
			(await t.client.get(`${base}/samples?name=/checkout&limit=1`, t.owner))
				.json,
		).items;

		const res = await t.client.get(`${base}/samples/${slowest.id}`, t.owner);
		const detail = sampleDetailDtoSchema.parse(res.json);
		expect(detail).toMatchObject({
			name: "/checkout",
			durationMs: 1000,
			platform: null,
		});
		expect(detail.measurements.lcp.value).toBe(4000);
		expect(detail.spans.map((s) => [s.spanId, s.depth, s.durationMs])).toEqual([
			[SPAN_A, 1, 300],
			[SPAN_B, 2, 50],
		]);
		expect(detail.spans[0].offsetMs).toBeGreaterThanOrEqual(0);
	});

	it("permisos: 401 sin sesión, 403/404 a quien no es miembro, 404 si no existe", async () => {
		const t = await createTenant();
		const other = await createTenant();
		const base = `${t.projectPath}/performance`;
		expect((await t.client.get(`${base}/transactions`)).status).toBe(401);
		const foreign = await t.client.get(`${base}/transactions`, other.owner);
		expect(foreign.status).toBeGreaterThanOrEqual(403);
		expect(
			(await t.client.get(`${base}/overview?period=1y`, t.owner)).status,
		).toBe(400);

		const missing = await t.client.get(
			`${base}/samples/00000000-0000-4000-8000-000000000000`,
			t.owner,
		);
		expect(missing.status).toBe(404);
		expect(errorResponseSchema.parse(missing.json).reason).toBe(
			"TRANSACTION_NOT_FOUND",
		);

		// Una muestra de otro proyecto no se ve desde éste.
		await other.client.ingestTransaction(
			other.projectId,
			other.key,
			transaction(),
		);
		await eventually(async () =>
			expect(
				await scalar(
					"select count(*) from perf_transaction where project_id = $1",
					[other.projectId],
				),
			).toBe(1),
		);
		const [foreignSample] = sampleListDtoSchema.parse(
			(
				await other.client.get(
					`${other.projectPath}/performance/samples?name=/checkout`,
					other.owner,
				)
			).json,
		).items;
		expect(
			(await t.client.get(`${base}/samples/${foreignSample.id}`, t.owner))
				.status,
		).toBe(404);
	});
});
