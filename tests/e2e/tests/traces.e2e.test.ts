import {
	errorResponseSchema,
	eventDetailDtoSchema,
	traceDtoSchema,
} from "@sentinel/shared";
import { describe, expect, it } from "vitest";
import { scalar } from "../support/db.js";
import { eventually } from "../support/eventually.js";
import {
	createTenant,
	errorEvent,
	minutesAgo,
	transaction,
} from "../support/factories.js";

const TRACE = "4bf92f3577b34da6a3ce929d0e0e4736";
const BROWSER_SPAN = "00f067aa0ba902b7";
const SERVER_SPAN = "b9c7c989f97918e1";
const FETCH_SPAN = "a1b2c3d4e5f60718";

/** Una traza que cruza del navegador al backend, con un error en cada lado. */
async function seed() {
	const t = await createTenant();
	const send = (body: unknown) =>
		t.client.ingestTransaction(t.projectId, t.key, body);
	await send({
		...transaction({
			name: "/checkout",
			traceId: TRACE,
			timestamp: minutesAgo(5),
			durationMs: 900,
			// La petición al backend es un span del navegador: el servidor continúa desde él.
			spans: [
				{
					span_id: FETCH_SPAN,
					parent_span_id: BROWSER_SPAN,
					op: "http.client",
					description: "POST /api/orders",
					start_timestamp: minutesAgo(5),
					duration_ms: 320,
				},
			],
		}),
		span_id: BROWSER_SPAN,
		platform: "javascript",
	});
	await send({
		...transaction({
			name: "POST /api/orders",
			traceId: TRACE,
			timestamp: minutesAgo(5),
			durationMs: 300,
			spans: [],
		}),
		span_id: SERVER_SPAN,
		parent_span_id: FETCH_SPAN,
		op: "http.server",
		platform: "node",
		status: "internal_error",
	});
	const withTrace = (
		spanId: string,
		over: Parameters<typeof errorEvent>[0],
	) => ({
		...errorEvent(over),
		contexts: { trace: { trace_id: TRACE, span_id: spanId } },
	});
	await t.client.ingest(
		t.projectId,
		t.key,
		withTrace(BROWSER_SPAN, {
			type: "TypeError",
			value: "x is undefined",
			timestamp: minutesAgo(5),
		}),
	);
	await t.client.ingest(
		t.projectId,
		t.key,
		withTrace(SERVER_SPAN, {
			type: "PaymentError",
			value: "card declined",
			fn: "charge",
			timestamp: minutesAgo(4),
		}),
	);
	// Un error cualquiera, sin traza.
	await t.client.ingest(
		t.projectId,
		t.key,
		errorEvent({ type: "RangeError", value: "otro", fn: "other" }),
	);
	await eventually(async () => {
		expect(
			await scalar(
				"select count(*) from perf_transaction where project_id = $1",
				[t.projectId],
			),
		).toBe(2);
		expect(
			await scalar("select count(*) from event where project_id = $1", [
				t.projectId,
			]),
		).toBe(3);
	});
	return t;
}

describe("trazas: error y rendimiento enlazados", () => {
	it("el evento guarda su traza y el detalle la expone", async () => {
		const t = await seed();
		expect(
			await scalar(
				"select count(*) from event where project_id = $1 and trace_id = $2",
				[t.projectId, TRACE],
			),
		).toBe(2);

		const issues = (
			await t.client.get(`${t.projectPath}/issues?status=all`, t.owner)
		).json.items as Array<{ id: string; type: string }>;
		const typeError = issues.find((i) => i.type === "TypeError");
		const range = issues.find((i) => i.type === "RangeError");
		const detail = (
			await t.client.get(`${t.projectPath}/issues/${typeError?.id}`, t.owner)
		).json;
		expect(eventDetailDtoSchema.parse(detail.latestEvent).traceId).toBe(TRACE);
		const plain = (
			await t.client.get(`${t.projectPath}/issues/${range?.id}`, t.owner)
		).json;
		expect(eventDetailDtoSchema.parse(plain.latestEvent).traceId).toBeNull();
	});

	it("GET traces/:id une las transacciones de cada servicio y los errores de la traza", async () => {
		const t = await seed();
		const res = await t.client.get(
			`${t.projectPath}/performance/traces/${TRACE.toUpperCase()}`,
			t.owner,
		);
		expect(res.status).toBe(200);
		const trace = traceDtoSchema.parse(res.json);

		expect(trace.traceId).toBe(TRACE);
		expect(
			trace.transactions.map((x) => [x.name, x.platform, x.parentSpanId]),
		).toEqual([
			["/checkout", "javascript", null],
			["POST /api/orders", "node", FETCH_SPAN],
		]);
		// El servidor cuelga del span de fetch del navegador: la transacción padre se resuelve a través de él.
		const [browser, server] = trace.transactions;
		expect(browser.parentTransactionId).toBeNull();
		expect(server.parentTransactionId).toBe(browser.id);
		expect(trace.events.map((e) => [e.issueTitle, e.spanId])).toEqual([
			["TypeError: x is undefined", BROWSER_SPAN],
			["PaymentError: card declined", SERVER_SPAN],
		]);
	});

	it("una traza inexistente o mal formada y los permisos", async () => {
		const t = await seed();
		const other = await createTenant();
		const base = `${t.projectPath}/performance/traces`;
		const missing = await t.client.get(`${base}/${"a".repeat(32)}`, t.owner);
		expect(missing.status).toBe(404);
		expect(errorResponseSchema.parse(missing.json).reason).toBe(
			"TRACE_NOT_FOUND",
		);
		expect(
			(await t.client.get(`${base}/no-es-una-traza`, t.owner)).status,
		).toBe(400);
		expect((await t.client.get(`${base}/${TRACE}`)).status).toBe(401);
		expect(
			(await t.client.get(`${base}/${TRACE}`, other.owner)).status,
		).toBeGreaterThanOrEqual(403);
		// La traza de un proyecto no se ve desde otro.
		const own = other.projectPath;
		expect(
			(
				await other.client.get(
					`${own}/performance/traces/${TRACE}`,
					other.owner,
				)
			).status,
		).toBe(404);
	});
});
