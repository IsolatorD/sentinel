import { Queue } from "bullmq";
import { afterAll, describe, expect, inject, it } from "vitest";
import { scalar } from "../support/db.js";
import { eventually } from "../support/eventually.js";
import {
	createTenant,
	errorEvent,
	type Tenant,
	transaction,
} from "../support/factories.js";

const { redis } = inject("e2e");
const queue = new Queue("maintenance", {
	connection: { host: redis.host, port: redis.port, db: redis.db },
});
afterAll(() => queue.close());

const daysAgo = (n: number) =>
	new Date(Date.now() - n * 86_400_000).toISOString();

/** Dos issues solo con eventos viejos y recientes, y dos transacciones (una vieja y una reciente). */
async function seed(t: Tenant) {
	const send = (e: unknown) => t.client.ingest(t.projectId, t.key, e);
	await send(
		errorEvent({
			type: "OldError",
			value: "gone",
			fn: "old",
			timestamp: daysAgo(40),
		}),
	);
	await send(
		errorEvent({
			type: "MixedError",
			value: "m",
			fn: "mixed",
			user: "u1",
			timestamp: daysAgo(40),
		}),
	);
	await send(
		errorEvent({
			type: "MixedError",
			value: "m",
			fn: "mixed",
			user: "u2",
			timestamp: daysAgo(1),
		}),
	);
	await send(
		errorEvent({
			type: "RecentError",
			value: "r",
			fn: "recent",
			timestamp: daysAgo(2),
		}),
	);
	await t.client.ingestTransaction(
		t.projectId,
		t.key,
		transaction({ name: "/old", timestamp: daysAgo(40) }),
	);
	await t.client.ingestTransaction(
		t.projectId,
		t.key,
		transaction({ name: "/new", timestamp: daysAgo(1) }),
	);
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
		).toBe(2);
	});
}

const counts = async (t: Tenant) => ({
	issues: await scalar("select count(*) from issue where project_id = $1", [
		t.projectId,
	]),
	events: await scalar("select count(*) from event where project_id = $1", [
		t.projectId,
	]),
	transactions: await scalar(
		"select count(*) from perf_transaction where project_id = $1",
		[t.projectId],
	),
	spans: await scalar(
		"select count(*) from perf_span s join perf_transaction x on x.id = s.transaction_id where x.project_id = $1",
		[t.projectId],
	),
});

describe("retención de datos", () => {
	it("borra lo anterior a la retención de cada proyecto y conserva lo demás", async () => {
		const short = await createTenant();
		const long = await createTenant();
		await short.client.patch(
			short.projectPath,
			{ retentionDays: 30 },
			short.owner,
		);
		await long.client.patch(
			long.projectPath,
			{ retentionDays: 365 },
			long.owner,
		);
		await seed(short);
		await seed(long);
		expect(await counts(short)).toEqual({
			issues: 3,
			events: 4,
			transactions: 2,
			spans: 2,
		});

		await queue.add("retention", {});
		await eventually(async () =>
			expect((await counts(short)).transactions).toBe(1),
		);

		// Retención de 30 días: se va el issue que solo tenía un evento viejo, y el evento viejo del mixto.
		expect(await counts(short)).toEqual({
			issues: 2,
			events: 2,
			transactions: 1,
			spans: 1,
		});
		expect(
			await scalar(
				"select count(*) from issue where project_id = $1 and type = 'OldError'",
				[short.projectId],
			),
		).toBe(0);
		expect(
			await scalar(
				"select count(*) from event where project_id = $1 and \"timestamp\" < now() - interval '30 days'",
				[short.projectId],
			),
		).toBe(0);
		// El issue mixto sigue con su evento reciente.
		expect(
			await scalar(
				"select count(*) from event e join issue i on i.id = e.issue_id where e.project_id = $1 and i.type = 'MixedError'",
				[short.projectId],
			),
		).toBe(1);
		// Retención de 365 días: no se toca nada.
		expect(await counts(long)).toEqual({
			issues: 3,
			events: 4,
			transactions: 2,
			spans: 2,
		});
	});

	it("la retención se configura por proyecto: solo las opciones permitidas y solo administradores", async () => {
		const t = await createTenant();
		const get = async () =>
			(await t.client.get(t.projectPath, t.owner)).json.retentionDays;
		expect(await get()).toBe(90); // por defecto
		expect(
			(await t.client.patch(t.projectPath, { retentionDays: 180 }, t.owner))
				.status,
		).toBe(200);
		expect(await get()).toBe(180);
		expect(
			(await t.client.patch(t.projectPath, { retentionDays: 7 }, t.owner))
				.status,
		).toBe(400);
		expect(await get()).toBe(180);
	});
});
