import { errorResponseSchema, usageDtoSchema } from "@sentinel/shared";
import { describe, expect, it } from "vitest";
import {
	createTenant,
	errorEvent,
	type Tenant,
	transaction,
} from "../support/factories.js";

const usageOf = async (t: Tenant) =>
	usageDtoSchema.parse(
		(await t.client.get(`${t.projectPath}/usage`, t.owner)).json,
	);
const sendEvent = (t: Tenant, n: number) =>
	t.client.ingest(
		t.projectId,
		t.key,
		errorEvent({ value: `distinct ${n}`, eventId: crypto.randomUUID() }),
	);
const setQuota = (t: Tenant, body: Record<string, number | null>) =>
	t.client.patch(t.projectPath, body, t.owner);

describe("cuotas mensuales", () => {
	it("al llegar al límite la ingesta responde 429 con Retry-After, y lo rechazado no gasta cuota", async () => {
		const t = await createTenant();
		expect((await setQuota(t, { monthlyEventQuota: 3 })).status).toBe(200);

		for (let i = 0; i < 3; i++)
			expect((await sendEvent(t, i)).status).toBe(202);
		const blocked = await sendEvent(t, 99);
		expect(blocked.status).toBe(429);
		expect(errorResponseSchema.parse(blocked.json)).toMatchObject({
			code: "TOO_MANY_REQUESTS",
			reason: "QUOTA_EXCEEDED",
		});
		const retry = Number(blocked.headers.get("retry-after"));
		expect(retry).toBeGreaterThan(0);
		expect(retry).toBeLessThanOrEqual(3_600);

		// Siguen los rechazos y el contador no avanza.
		expect((await sendEvent(t, 100)).status).toBe(429);
		expect((await usageOf(t)).events).toEqual({ used: 3, quota: 3 });
	});

	it("los eventos y las transacciones tienen cuotas independientes", async () => {
		const t = await createTenant();
		await setQuota(t, { monthlyEventQuota: 1, monthlyTransactionQuota: 2 });
		expect((await sendEvent(t, 1)).status).toBe(202);
		expect((await sendEvent(t, 2)).status).toBe(429);

		for (let i = 0; i < 2; i++)
			expect(
				(
					await t.client.ingestTransaction(
						t.projectId,
						t.key,
						transaction({ transactionId: crypto.randomUUID() }),
					)
				).status,
			).toBe(202);
		const blocked = await t.client.ingestTransaction(
			t.projectId,
			t.key,
			transaction(),
		);
		expect(blocked.status).toBe(429);
		expect(errorResponseSchema.parse(blocked.json).reason).toBe(
			"QUOTA_EXCEEDED",
		);

		const usage = await usageOf(t);
		expect(usage.events).toEqual({ used: 1, quota: 1 });
		expect(usage.transactions).toEqual({ used: 2, quota: 2 });
	});

	it("subir o quitar el límite surte efecto de inmediato", async () => {
		const t = await createTenant();
		await setQuota(t, { monthlyEventQuota: 1 });
		expect((await sendEvent(t, 1)).status).toBe(202);
		expect((await sendEvent(t, 2)).status).toBe(429);

		await setQuota(t, { monthlyEventQuota: 5 });
		expect((await sendEvent(t, 3)).status).toBe(202);
		await setQuota(t, { monthlyEventQuota: null });
		for (let i = 0; i < 4; i++)
			expect((await sendEvent(t, 10 + i)).status).toBe(202);
		const usage = await usageOf(t);
		expect(usage.events.quota).toBeNull();
		expect(usage.events.used).toBe(6);
	});

	it("un evento inválido no gasta cuota", async () => {
		const t = await createTenant();
		await setQuota(t, { monthlyEventQuota: 1 });
		expect(
			(await t.client.ingest(t.projectId, t.key, { level: "nope" })).status,
		).toBe(400);
		expect((await usageOf(t)).events.used).toBe(0);
		expect((await sendEvent(t, 1)).status).toBe(202);
	});

	it("el uso del mes se ve sin límite y el proyecto sin cuota nunca se bloquea", async () => {
		const t = await createTenant();
		for (let i = 0; i < 3; i++) await sendEvent(t, i);
		const usage = await usageOf(t);
		expect(usage).toMatchObject({
			events: { used: 3, quota: null },
			transactions: { used: 0, quota: null },
		});
		expect(usage.month).toBe(new Date().toISOString().slice(0, 7));
		expect(new Date(usage.resetsAt).getTime()).toBeGreaterThan(Date.now());
	});

	it("el límite se valida y solo lo cambian administradores; el uso lo ve cualquier miembro", async () => {
		const t = await createTenant();
		for (const bad of [0, -5, 1.5, 2_000_000_000])
			expect((await setQuota(t, { monthlyEventQuota: bad })).status).toBe(400);
		expect((await setQuota(t, {})).status).toBe(400);

		const other = await createTenant();
		expect((await t.client.get(`${t.projectPath}/usage`)).status).toBe(401);
		expect(
			(await t.client.get(`${t.projectPath}/usage`, other.owner)).status,
		).toBeGreaterThanOrEqual(403);
		// El proyecto de otra organización no se ve con el id de la propia.
		const foreign = await t.client.get(
			`/api/organizations/${t.orgId}/projects/${other.projectId}/usage`,
			t.owner,
		);
		expect(foreign.status).toBe(404);
	});
});
