import { dashboardDtoSchema } from "@sentinel/shared";
import { describe, expect, it } from "vitest";
import { scalar } from "../support/db.js";
import { eventually } from "../support/eventually.js";
import {
	createTenant,
	errorEvent,
	minutesAgo,
	type Tenant,
	transaction,
} from "../support/factories.js";

/**
 * Últimas 24 h: 3 eventos (2 de TypeError en producción, 1 aviso en staging; usuarios u1 y u2), 4 transacciones
 * (100, 200, 300 y 1000 ms; la última falla). Periodo anterior: 1 evento de otro issue y 1 transacción.
 */
async function seed(t: Tenant) {
	const send = (e: unknown) => t.client.ingest(t.projectId, t.key, e);
	await send(
		errorEvent({
			user: "u1",
			timestamp: minutesAgo(30),
			release: "1.0.0",
			environment: "prod",
		}),
	);
	await send(
		errorEvent({
			user: "u2",
			timestamp: minutesAgo(20),
			release: "1.0.0",
			environment: "prod",
		}),
	);
	await send({
		...errorEvent({
			type: "WarnError",
			value: "careful",
			fn: "warn",
			user: "u1",
			timestamp: minutesAgo(10),
			release: "2.0.0",
			environment: "staging",
		}),
		level: "warning",
	});
	await send(
		errorEvent({
			type: "OldError",
			value: "old",
			fn: "older",
			timestamp: minutesAgo(26 * 60),
			environment: "prod",
		}),
	);
	const tx = (
		name: string,
		durationMs: number,
		minutes: number,
		status = "ok",
		environment = "prod",
	) =>
		t.client.ingestTransaction(
			t.projectId,
			t.key,
			transaction({
				name,
				durationMs,
				timestamp: minutesAgo(minutes),
				status,
				environment,
			}),
		);
	await tx("/home", 100, 40);
	await tx("/home", 200, 35);
	await tx("/cart", 300, 30);
	await tx("/checkout", 1000, 25, "internal_error", "staging");
	await tx("/home", 150, 26 * 60);
	await eventually(async () => {
		expect(
			await scalar("select count(*) from event where project_id = $1", [
				t.projectId,
			]),
		).toBe(4);
		expect(
			await scalar(
				"select count(*) from perf_transaction where project_id = $1",
				[t.projectId],
			),
		).toBe(5);
	});
}

const dashboard = async (t: Tenant, query = "period=24h") => {
	const res = await t.client.get(
		`${t.projectPath}/dashboard?${query}`,
		t.owner,
	);
	expect(res.status).toBe(200);
	return dashboardDtoSchema.parse(res.json);
};

describe("panel de estadísticas", () => {
	it("totales del periodo y comparación con el anterior", async () => {
		const t = await createTenant();
		await seed(t);
		const d = await dashboard(t);

		expect(d.totals).toMatchObject({
			events: 3,
			users: 2,
			newIssues: 2,
			resolvedIssues: 0,
			transactions: 4,
		});
		expect(d.totals.errorRate).toBe(0.25);
		expect(d.totals.p95).toBeCloseTo(895, 0);
		expect(d.previous).toEqual({ events: 1, newIssues: 1, transactions: 1 });
	});

	it("series continuas, repartos y rankings", async () => {
		const t = await createTenant();
		await seed(t);
		const d = await dashboard(t);

		expect(d.series).toHaveLength(24);
		expect(d.series.reduce((n, p) => n + p.events, 0)).toBe(3);
		expect(d.series.reduce((n, p) => n + p.transactions, 0)).toBe(4);
		expect(d.series.reduce((n, p) => n + p.newIssues, 0)).toBe(2);

		expect(Object.fromEntries(d.byLevel.map((b) => [b.key, b.count]))).toEqual({
			error: 2,
			warning: 1,
		});
		expect(
			Object.fromEntries(d.byEnvironment.map((b) => [b.key, b.count])),
		).toEqual({ prod: 2, staging: 1 });
		expect(
			Object.fromEntries(d.byRelease.map((b) => [b.key, b.count])),
		).toEqual({ "1.0.0": 2, "2.0.0": 1 });

		expect(d.topIssues.map((i) => [i.title, i.events, i.users])).toEqual([
			["TypeError: x is undefined", 2, 2],
			["WarnError: careful", 1, 1],
		]);
		expect(d.slowest.map((s) => s.name)).toEqual([
			"/checkout",
			"/cart",
			"/home",
		]);
		expect(d.slowest[0].p95).toBe(1000);
	});

	it("cuenta los issues resueltos en el periodo", async () => {
		const t = await createTenant();
		await seed(t);
		const issues = (
			await t.client.get(`${t.projectPath}/issues?status=all`, t.owner)
		).json.items as Array<{ id: string; type: string }>;
		const warn = issues.find((i) => i.type === "WarnError");
		expect(
			(
				await t.client.patch(
					`${t.projectPath}/issues/${warn?.id}`,
					{ status: "resolved" },
					t.owner,
				)
			).status,
		).toBe(200);
		expect((await dashboard(t)).totals.resolvedIssues).toBe(1);
	});

	it("el filtro de entorno acota eventos y transacciones", async () => {
		const t = await createTenant();
		await seed(t);
		const d = await dashboard(t, "period=24h&environment=staging");
		expect(d.totals).toMatchObject({ events: 1, transactions: 1, users: 1 });
		expect(d.totals.errorRate).toBe(1);
		expect(d.topIssues.map((i) => i.title)).toEqual(["WarnError: careful"]);
	});

	it("un proyecto sin datos devuelve ceros, sin fallar", async () => {
		const t = await createTenant();
		const d = await dashboard(t, "period=30d");
		expect(d.totals).toEqual({
			events: 0,
			users: 0,
			newIssues: 0,
			resolvedIssues: 0,
			transactions: 0,
			p95: null,
			errorRate: 0,
		});
		expect(d.series).toHaveLength(30);
		expect(d.topIssues).toEqual([]);
		expect(d.slowest).toEqual([]);
	});

	it("el periodo se valida y hace falta ser miembro", async () => {
		const t = await createTenant();
		const other = await createTenant();
		expect(
			(await t.client.get(`${t.projectPath}/dashboard?period=1y`, t.owner))
				.status,
		).toBe(400);
		expect((await t.client.get(`${t.projectPath}/dashboard`)).status).toBe(401);
		expect(
			(await t.client.get(`${t.projectPath}/dashboard`, other.owner)).status,
		).toBeGreaterThanOrEqual(403);
		// Sin periodo, 7 días.
		expect((await dashboard(t, "")).period).toBe("7d");
	});
});
