import { deliveryListDtoSchema, ruleDtoSchema } from "@sentinel/shared";
import { Queue } from "bullmq";
import { afterAll, afterEach, describe, expect, inject, it } from "vitest";
import { db, scalar } from "../support/db.js";
import { eventually } from "../support/eventually.js";
import {
	createTenant,
	minutesAgo,
	type Tenant,
	transaction,
} from "../support/factories.js";
import { type Receiver, startReceiver } from "../support/receiver.js";

const { redis } = inject("e2e");
const queue = new Queue("performance-alerts", {
	connection: { host: redis.host, port: redis.port, db: redis.db },
});
afterAll(() => queue.close());

const receivers: Receiver[] = [];
afterEach(async () => {
	await Promise.all(receivers.splice(0).map((r) => r.close()));
});

const alerts = (t: Tenant) => `${t.projectPath}/alerts`;

/** Un tenant con un webhook que apunta a un receptor local. */
async function setup() {
	const t = await createTenant();
	const receiver = await startReceiver();
	receivers.push(receiver);
	const res = await t.client.post(
		`${alerts(t)}/channels`,
		{ type: "webhook", name: "Ops", url: receiver.url },
		t.owner,
	);
	expect(res.status, res.text).toBe(201);
	return { t, receiver, channelId: res.json.id as string };
}

async function createRule(
	t: Tenant,
	channelId: string,
	body: Record<string, unknown>,
) {
	const res = await t.client.post(
		`${alerts(t)}/rules`,
		{ cooldownMinutes: 0, channelIds: [channelId], name: "Regla", ...body },
		t.owner,
	);
	expect(res.status, res.text).toBe(201);
	return ruleDtoSchema.parse(res.json);
}

/** Envía N transacciones y espera a que el worker las guarde. */
async function send(
	t: Tenant,
	count: number,
	over: Parameters<typeof transaction>[0] = {},
) {
	const before = await stored(t);
	for (let i = 0; i < count; i++) {
		const res = await t.client.ingestTransaction(
			t.projectId,
			t.key,
			transaction({ timestamp: minutesAgo(2), ...over }),
		);
		expect(res.status).toBe(202);
	}
	await eventually(async () => expect(await stored(t)).toBe(before + count));
}
const stored = (t: Tenant) =>
	scalar("select count(*) from perf_transaction where project_id = $1", [
		t.projectId,
	]);

/** Lanza la evaluación de las reglas y espera a que el worker la termine. */
async function evaluate() {
	const job = await queue.add("evaluate", {});
	await eventually(async () => expect(await job.isCompleted()).toBe(true));
}

const deliveries = async (t: Tenant) =>
	deliveryListDtoSchema.parse(
		(await t.client.get(`${alerts(t)}/deliveries?limit=100`, t.owner)).json,
	);

describe("alertas de rendimiento", () => {
	it("una regla de p95 avisa por webhook con lo medido, y queda en el historial sin issue", async () => {
		const { t, receiver, channelId } = await setup();
		await createRule(t, channelId, {
			trigger: "p95_above",
			threshold: 1000,
			windowMinutes: 15,
		});
		await send(t, 12, { durationMs: 2500 });
		await evaluate();

		await eventually(async () => expect(receiver.requests).toHaveLength(1));
		const body = receiver.requests[0].json;
		expect(body.event).toBe("performance.p95");
		expect(body.rule).toEqual({ name: "Regla", trigger: "p95_above" });
		expect(body.issue).toBeUndefined();
		expect(body.performance).toMatchObject({
			transaction: null,
			value: 2500,
			threshold: 1000,
			windowMinutes: 15,
			sampleCount: 12,
		});
		expect(body.url).toMatch(/\/performance$/);

		await eventually(async () =>
			expect((await deliveries(t)).items[0]?.status).toBe("sent"),
		);
		const [row] = (await deliveries(t)).items;
		expect(row).toMatchObject({
			kind: "alert",
			ruleName: "Regla",
			issueId: null,
			channelName: "Ops",
		});
		expect(row.issueTitle).toBe("All transactions · p95 2.5 s");
	});

	it("una regla de tasa de errores usa el porcentaje de transacciones que fallaron", async () => {
		const { t, receiver, channelId } = await setup();
		await createRule(t, channelId, {
			trigger: "error_rate_above",
			threshold: 20,
			windowMinutes: 15,
		});
		await send(t, 8, { status: "ok" });
		await send(t, 4, { status: "internal_error" }); // 4 de 12 = 33 %
		await evaluate();

		await eventually(async () => expect(receiver.requests).toHaveLength(1));
		const body = receiver.requests[0].json;
		expect(body.event).toBe("performance.error_rate");
		expect(body.performance.value).toBeCloseTo(33.33, 1);
		expect(body.performance.sampleCount).toBe(12);
	});

	it("no avisa si el valor está bajo el umbral ni con pocas muestras", async () => {
		const ok = await setup();
		await createRule(ok.t, ok.channelId, {
			trigger: "p95_above",
			threshold: 5000,
			windowMinutes: 15,
		});
		await send(ok.t, 12, { durationMs: 2500 });

		const few = await setup();
		await createRule(few.t, few.channelId, {
			trigger: "p95_above",
			threshold: 1000,
			windowMinutes: 15,
		});
		await send(few.t, 9, { durationMs: 9000 }); // muy lento, pero solo 9 muestras

		await evaluate();
		await new Promise((r) => setTimeout(r, 500));
		expect((await deliveries(ok.t)).total).toBe(0);
		expect((await deliveries(few.t)).total).toBe(0);
		expect(ok.receiver.requests).toHaveLength(0);
		expect(few.receiver.requests).toHaveLength(0);
	});

	it("una regla de una transacción solo mira esa transacción, y respeta el entorno", async () => {
		const { t, receiver, channelId } = await setup();
		await createRule(t, channelId, {
			trigger: "p95_above",
			threshold: 1000,
			windowMinutes: 15,
			transactionName: "/checkout",
			environment: "production",
		});
		await send(t, 12, {
			name: "/cart",
			durationMs: 9000,
			environment: "production",
		});
		await send(t, 12, {
			name: "/checkout",
			durationMs: 9000,
			environment: "staging",
		});
		await evaluate();
		await new Promise((r) => setTimeout(r, 500));
		expect(receiver.requests).toHaveLength(0);

		await send(t, 12, {
			name: "/checkout",
			durationMs: 3000,
			environment: "production",
		});
		await evaluate();
		await eventually(async () => expect(receiver.requests).toHaveLength(1));
		const { performance } = receiver.requests[0].json;
		expect(performance).toMatchObject({
			transaction: "/checkout",
			environment: "production",
			value: 3000,
			sampleCount: 12,
		});
		expect(receiver.requests[0].json.url).toContain(
			"/performance/transaction?name=%2Fcheckout",
		);
	});

	it("la ventana se mide por cuándo llegaron las transacciones, no por su fecha de inicio", async () => {
		const { t, receiver, channelId } = await setup();
		await createRule(t, channelId, {
			trigger: "p95_above",
			threshold: 1000,
			windowMinutes: 5,
		});
		// Un SDK que reenvía un buffer viejo: empezaron hace una hora, pero llegaron ahora.
		await send(t, 12, { durationMs: 3000, timestamp: minutesAgo(60) });
		await evaluate();
		await eventually(async () => expect(receiver.requests).toHaveLength(1));

		// Si llegaron hace más de la ventana, ya no cuentan.
		await db().query(
			"update perf_transaction set received_at = now() - interval '30 minutes' where project_id = $1",
			[t.projectId],
		);
		await db().query("delete from alert_delivery where project_id = $1", [
			t.projectId,
		]);
		await evaluate();
		await new Promise((r) => setTimeout(r, 500));
		expect(receiver.requests).toHaveLength(1);
		expect((await deliveries(t)).total).toBe(0);
	});

	it("la espera evita repetir el aviso en cada evaluación", async () => {
		const { t, receiver, channelId } = await setup();
		await createRule(t, channelId, {
			trigger: "p95_above",
			threshold: 1000,
			windowMinutes: 15,
			cooldownMinutes: 60,
		});
		await send(t, 12, { durationMs: 2500 });
		await evaluate();
		await evaluate();
		await eventually(async () => expect(receiver.requests).toHaveLength(1));
		await new Promise((r) => setTimeout(r, 500));
		expect(receiver.requests).toHaveLength(1);
		expect((await deliveries(t)).total).toBe(1);
	});

	it("una regla desactivada no avisa", async () => {
		const { t, receiver, channelId } = await setup();
		await createRule(t, channelId, {
			trigger: "p95_above",
			threshold: 1000,
			windowMinutes: 15,
			enabled: false,
		});
		await send(t, 12, { durationMs: 2500 });
		await evaluate();
		await new Promise((r) => setTimeout(r, 500));
		expect(receiver.requests).toHaveLength(0);
	});
});

describe("reglas de rendimiento: validación", () => {
	it("exigen umbral y ventana (de al menos 5 minutos) y no llevan nivel mínimo", async () => {
		const { t, channelId } = await setup();
		const post = (body: Record<string, unknown>) =>
			t.client.post(
				`${alerts(t)}/rules`,
				{ name: "x", channelIds: [channelId], ...body },
				t.owner,
			);
		expect((await post({ trigger: "p95_above" })).status).toBe(400);
		expect(
			(await post({ trigger: "p95_above", threshold: 800, windowMinutes: 1 }))
				.status,
		).toBe(400);
		expect(
			(
				await post({
					trigger: "error_rate_above",
					threshold: 150,
					windowMinutes: 15,
				})
			).status,
		).toBe(400);
		expect(
			(
				await post({
					trigger: "p95_above",
					threshold: 800,
					windowMinutes: 15,
					minLevel: "error",
				})
			).status,
		).toBe(400);
		// La transacción solo tiene sentido en reglas de rendimiento.
		expect(
			(await post({ trigger: "new_issue", transactionName: "/checkout" }))
				.status,
		).toBe(400);
	});

	it("al editar, cambiar a otro tipo quita lo que ya no aplica, y lo incoherente se rechaza", async () => {
		const { t, channelId } = await setup();
		const rule = await createRule(t, channelId, {
			trigger: "p95_above",
			threshold: 800,
			windowMinutes: 15,
			transactionName: "/checkout",
		});
		const path = `${alerts(t)}/rules/${rule.id}`;

		// Cambiar el umbral deja el resto igual.
		const bumped = ruleDtoSchema.parse(
			(await t.client.patch(path, { threshold: 1500 }, t.owner)).json,
		);
		expect(bumped).toMatchObject({
			threshold: 1500,
			windowMinutes: 15,
			transactionName: "/checkout",
		});

		// Quitar la transacción vuelve a vigilar todo el proyecto.
		const all = ruleDtoSchema.parse(
			(await t.client.patch(path, { transactionName: null }, t.owner)).json,
		);
		expect(all.transactionName).toBeNull();

		// Un nivel mínimo no encaja en una regla de rendimiento.
		expect(
			(await t.client.patch(path, { minLevel: "error" }, t.owner)).status,
		).toBe(400);

		// Pasar a "issue nuevo" limpia umbral, ventana y transacción.
		const converted = ruleDtoSchema.parse(
			(await t.client.patch(path, { trigger: "new_issue" }, t.owner)).json,
		);
		expect(converted).toMatchObject({
			trigger: "new_issue",
			threshold: null,
			windowMinutes: null,
			transactionName: null,
		});

		// Y volver a rendimiento sin umbral no es válido.
		expect(
			(await t.client.patch(path, { trigger: "p95_above" }, t.owner)).status,
		).toBe(400);
	});
});
