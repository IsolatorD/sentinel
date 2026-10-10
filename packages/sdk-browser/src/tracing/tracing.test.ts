import { ingestTransactionSchema } from "@sentinel/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { z } from "zod";
import type { SentinelClient } from "../client";
import { createTestClient } from "../test-utils";
import type { SentinelTransaction } from "../types";
import { Tracer } from "./tracer";
import type { Transaction } from "./transaction";

// Comprobación en compilación: la transacción del SDK debe ser asignable al contrato del servidor.
const _assignable = (
	t: SentinelTransaction,
): z.input<typeof ingestTransactionSchema> => t;
void _assignable;

function makeTracer(
	over: Partial<ConstructorParameters<typeof Tracer>[0]> = {},
) {
	const finished: Transaction[] = [];
	const tracer = new Tracer(
		{
			sampleRate: 1,
			pageload: false,
			navigation: false,
			http: true,
			webVitals: false,
			maxSpans: 100,
			idleTimeoutMs: 1_000,
			finalTimeoutMs: 15_000,
			...over,
		},
		{ onFinish: (tx) => finished.push(tx) },
	);
	return { tracer, finished };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

describe("transacciones y spans", () => {
	it("una transacción manual mide sus spans y se envía al terminar", () => {
		const { tracer, finished } = makeTracer();
		const tx = tracer.startTransaction({ name: "checkout", op: "task" });
		const span = tracer.startSpan("db.query", "SELECT 1");
		vi.advanceTimersByTime(40);
		span.end();
		vi.advanceTimersByTime(10);
		tx.finish();

		expect(finished).toHaveLength(1);
		expect(tx.durationMs).toBe(50);
		expect(tx.spans).toHaveLength(1);
		expect(tx.spans[0]).toMatchObject({
			op: "db.query",
			description: "SELECT 1",
			parentSpanId: tx.spanId,
		});
		expect(tx.spans[0].endMs).toBeDefined();
		expect((tx.spans[0].endMs ?? 0) - tx.spans[0].startMs).toBe(40);
	});

	it("terminar dos veces no la envía dos veces; los spans abiertos se cancelan", () => {
		const { tracer, finished } = makeTracer();
		const tx = tracer.startTransaction({ name: "t" });
		const open = tracer.startSpan("slow");
		tx.finish();
		tx.finish();
		expect(finished).toHaveLength(1);
		expect(open.status).toBe("cancelled");
		expect(open.finished).toBe(true);
	});

	it("respeta el máximo de spans por transacción", () => {
		const { tracer } = makeTracer({ maxSpans: 2 });
		const tx = tracer.startTransaction({ name: "t" });
		for (let i = 0; i < 5; i++) tracer.startSpan("x").end();
		expect(tx.spans).toHaveLength(2);
		expect(tx.droppedSpans).toBe(3);
	});

	it("sin muestreo no se registra ni se envía nada, pero el código sigue funcionando", () => {
		const { tracer, finished } = makeTracer({ sampleRate: 0 });
		const tx = tracer.startTransaction({ name: "t" });
		tracer.startSpan("x").end();
		tx.finish();
		expect(tx.sampled).toBe(false);
		expect(tx.spans).toHaveLength(0);
		expect(finished).toHaveLength(0);
	});

	it("startSpan sin transacción en curso devuelve un span que no se registra", () => {
		const { tracer } = makeTracer();
		const span = tracer.startSpan("x");
		expect(() => span.end()).not.toThrow();
		expect(tracer.active).toBeUndefined();
	});

	it("trace() cierra el span al terminar la función, también si es async o lanza", async () => {
		const { tracer } = makeTracer();
		const tx = tracer.startTransaction({ name: "t" });

		expect(tracer.trace("a", "sync", () => 7)).toBe(7);
		await expect(
			tracer.trace("b", "async", async () => {
				await Promise.resolve();
				return "ok";
			}),
		).resolves.toBe("ok");
		expect(() =>
			tracer.trace("c", "throws", () => {
				throw new Error("boom");
			}),
		).toThrow("boom");
		await expect(
			tracer.trace("d", "rejects", () => Promise.reject(new Error("no"))),
		).rejects.toThrow("no");

		expect(tx.spans.map((s) => [s.op, s.status ?? "ok"])).toEqual([
			["a", "ok"],
			["b", "ok"],
			["c", "internal_error"],
			["d", "internal_error"],
		]);
		expect(tx.spans.every((s) => s.finished)).toBe(true);
	});
});

describe("transacciones automáticas (idle)", () => {
	it("terminan solas tras 1 s sin actividad, con el fin en la última actividad", () => {
		const { tracer, finished } = makeTracer();
		const tx = tracer.startTransaction({ name: "/", idle: true });
		vi.advanceTimersByTime(300);
		const span = tracer.startSpan("http.client");
		vi.advanceTimersByTime(200);
		span.end();
		const lastActivity = tx.spans[0].endMs;

		vi.advanceTimersByTime(999);
		expect(finished).toHaveLength(0);
		vi.advanceTimersByTime(2);
		expect(finished).toHaveLength(1);
		expect(tx.endMs).toBe(lastActivity);
	});

	it("un span abierto las mantiene vivas hasta el límite de 15 s", () => {
		const { tracer, finished } = makeTracer();
		const tx = tracer.startTransaction({ name: "/", idle: true });
		tracer.startSpan("never.ends");
		vi.advanceTimersByTime(14_000);
		expect(finished).toHaveLength(0);
		vi.advanceTimersByTime(1_500);
		expect(finished).toHaveLength(1);
		expect(tx.status).toBe("deadline_exceeded");
	});

	it("hold() las mantiene vivas hasta que se libera", () => {
		const { tracer, finished } = makeTracer();
		const tx = tracer.startTransaction({ name: "/", idle: true });
		const release = tx.hold();
		vi.advanceTimersByTime(5_000);
		expect(finished).toHaveLength(0);
		release();
		vi.advanceTimersByTime(1_100);
		expect(finished).toHaveLength(1);
	});
});

describe("peticiones HTTP", () => {
	beforeEach(() => {
		vi.stubGlobal("location", new URL("https://app.example.com/cart"));
	});

	it("crea un span con el método y la ruta (sin query) y propaga traceparent al mismo origen", () => {
		const { tracer } = makeTracer();
		const tx = tracer.startTransaction({ name: "t" });
		const handle = tracer.startHttpSpan({
			method: "GET",
			url: "https://app.example.com/api/cart?token=secret",
		});
		expect(handle?.headers?.traceparent).toMatch(
			new RegExp(`^00-${tx.traceId}-[0-9a-f]{16}-01$`),
		);
		handle?.end(200);
		expect(tx.spans[0]).toMatchObject({
			op: "http.client",
			description: "GET /api/cart",
			status: "ok",
			data: {
				url: "https://app.example.com/api/cart",
				"http.status_code": 200,
			},
		});
		expect(JSON.stringify(tx.spans[0].data)).not.toContain("secret");
	});

	it("a otro origen no añade la cabecera, salvo que esté en tracePropagationTargets", () => {
		const other = "https://api.other.com/v1/items";
		const a = makeTracer();
		a.tracer.startTransaction({ name: "t" });
		expect(
			a.tracer.startHttpSpan({ method: "GET", url: other })?.headers,
		).toBeUndefined();

		const b = makeTracer({ propagationTargets: [/api\.other\.com/] });
		b.tracer.startTransaction({ name: "t" });
		expect(
			b.tracer.startHttpSpan({ method: "GET", url: other })?.headers,
		).toBeDefined();
	});

	it("traduce el código de estado y los fallos de red", () => {
		const { tracer } = makeTracer();
		const tx = tracer.startTransaction({ name: "t" });
		for (const code of [404, 500, undefined])
			tracer.startHttpSpan({ method: "GET", url: "/x" })?.end(code);
		expect(tx.spans.map((s) => s.status)).toEqual([
			"not_found",
			"internal_error",
			"internal_error",
		]);
	});

	it("sin transacción en curso o sin muestreo no hace nada", () => {
		const { tracer } = makeTracer();
		expect(tracer.startHttpSpan({ method: "GET", url: "/x" })).toBeUndefined();
		const off = makeTracer({ sampleRate: 0 });
		off.tracer.startTransaction({ name: "t" });
		expect(
			off.tracer.startHttpSpan({ method: "GET", url: "/x" }),
		).toBeUndefined();
	});
});

// ---------- Integración con el cliente ----------

let active: SentinelClient | undefined;
let fetchMock: ReturnType<typeof vi.fn>;

function boot(options: Parameters<typeof createTestClient>[0] = {}) {
	const t = createTestClient({ tracesSampleRate: 1, ...options });
	active = t.client.install();
	const transactions = () =>
		t.sent.filter((e) => "trace_id" in e) as unknown as SentinelTransaction[];
	return { ...t, transactions };
}

describe("SDK: rendimiento automático", () => {
	beforeEach(() => {
		fetchMock = vi.fn(async () => new Response("ok", { status: 200 }));
		window.fetch = fetchMock as unknown as typeof fetch;
	});
	afterEach(async () => {
		await active?.close();
		active = undefined;
		history.replaceState({}, "", "/");
	});

	it("por defecto (sin tracesSampleRate) no mide nada", async () => {
		const { client, transactions } = boot({ tracesSampleRate: undefined });
		await vi.advanceTimersByTimeAsync(3_000);
		await client.flush();
		expect(transactions()).toHaveLength(0);
		expect(client.startTransaction({ name: "x" })?.sampled).toBe(false);
	});

	it("mide la carga de página y la envía con un contrato válido", async () => {
		const { client, transactions } = boot({
			release: "1.2.3",
			environment: "prod",
		});
		await window.fetch("/api/items?page=2");
		await vi.advanceTimersByTimeAsync(1_500);
		await client.flush();

		const [tx] = transactions();
		expect(tx).toBeDefined();
		const parsed = ingestTransactionSchema.safeParse(tx);
		expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
		expect(tx).toMatchObject({
			op: "pageload",
			name: "/",
			platform: "javascript",
			release: "1.2.3",
			environment: "prod",
			status: "ok",
		});
		expect(tx.spans?.[0]).toMatchObject({
			op: "http.client",
			description: "GET /api/items",
			parent_span_id: tx.span_id,
		});
	});

	it("las peticiones del mismo origen llevan traceparent con la traza de la transacción", async () => {
		const { client, transactions } = boot();
		await window.fetch("/api/items");
		const call = fetchMock.mock.calls[0];
		const headers = new Headers((call[1] as RequestInit).headers);
		expect(headers.get("traceparent")).toMatch(
			/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/,
		);

		await vi.advanceTimersByTimeAsync(1_500);
		await client.flush();
		expect(headers.get("traceparent")?.split("-")[1]).toBe(
			transactions()[0].trace_id,
		);
	});

	it("una navegación sin recarga abre una transacción nueva y cierra la anterior", async () => {
		const { client, transactions } = boot();
		history.pushState({}, "", "/orders");
		await window.fetch("/api/orders");
		await vi.advanceTimersByTimeAsync(1_500);
		await client.flush();

		const byOp = Object.fromEntries(transactions().map((t) => [t.op, t]));
		expect(byOp.pageload).toBeDefined();
		expect(byOp.navigation).toMatchObject({ name: "/orders" });
		expect(byOp.navigation.spans?.[0].description).toBe("GET /api/orders");
		expect(byOp.navigation.trace_id).not.toBe(byOp.pageload.trace_id);
	});

	it("cambiar solo la query no cuenta como navegación", async () => {
		const { client, transactions } = boot();
		history.pushState({}, "", "/?tab=2");
		await vi.advanceTimersByTimeAsync(1_500);
		await client.flush();
		expect(transactions().map((t) => t.op)).toEqual(["pageload"]);
	});

	it("los errores capturados durante una transacción llevan su trace_id", async () => {
		const { client, sent } = boot();
		client.captureException(new Error("fallo en la carga"));
		await client.flush();
		const event = sent.find((e) => e.exception);
		const tx = client.startTransaction({ name: "x" });
		expect(event?.contexts?.trace).toMatchObject({
			trace_id: expect.stringMatching(/^[0-9a-f]{32}$/),
			span_id: expect.stringMatching(/^[0-9a-f]{16}$/),
		});
		tx?.finish();
	});

	it("una transacción manual con trace() se envía con sus spans", async () => {
		const { client, transactions } = boot({
			tracing: { pageload: false, navigation: false },
		});
		const tx = client.startTransaction({ name: "importar", op: "task" });
		await client.trace("parse", "csv", async () => {
			await vi.advanceTimersByTimeAsync(30);
		});
		tx?.finish();
		await client.flush();

		expect(transactions()).toHaveLength(1);
		expect(transactions()[0]).toMatchObject({ name: "importar", op: "task" });
		expect(transactions()[0].spans?.[0]).toMatchObject({
			op: "parse",
			description: "csv",
			duration_ms: 30,
		});
	});

	it("beforeSendTransaction puede modificar o descartar", async () => {
		const drop = boot({
			tracing: { pageload: false, navigation: false },
			beforeSendTransaction: () => null,
		});
		drop.client.startTransaction({ name: "a" })?.finish();
		await drop.client.flush();
		expect(drop.transactions()).toHaveLength(0);
		await active?.close();

		const edit = boot({
			tracing: { pageload: false, navigation: false },
			beforeSendTransaction: (t) => ({ ...t, name: "renombrada" }),
		});
		edit.client.startTransaction({ name: "a" })?.finish();
		await edit.client.flush();
		expect(edit.transactions()[0].name).toBe("renombrada");
	});

	it("close() termina y envía lo que se estaba midiendo", async () => {
		const { client, transactions } = boot();
		await client.close();
		expect(transactions()).toHaveLength(1);
	});

	it("las peticiones del propio SDK (eventos y transacciones) no generan spans", async () => {
		const { client, transactions } = boot({
			tracing: { pageload: false, navigation: false },
		});
		const tx = client.startTransaction({ name: "t" });
		await window.fetch(
			"https://api.example.com/api/48140d16-1ad4-4a8b-b08e-04762f0d78b9/transactions",
		);
		client.startSpan("x")?.end();
		tx?.finish();
		await client.flush();
		expect(transactions().flatMap((t) => t.spans ?? [])).toHaveLength(1);
	});
});

describe("Web Vitals", () => {
	class FakeObserver {
		static supportedEntryTypes = [
			"paint",
			"largest-contentful-paint",
			"layout-shift",
			"event",
		];
		static instances: FakeObserver[] = [];
		type = "";
		constructor(private cb: (list: { getEntries(): unknown[] }) => void) {
			FakeObserver.instances.push(this);
		}
		observe(opts: { type: string }) {
			this.type = opts.type;
		}
		disconnect() {}
		emit(entries: unknown[]) {
			this.cb({ getEntries: () => entries });
		}
	}
	const emit = (type: string, entries: unknown[]) => {
		for (const o of FakeObserver.instances)
			if (o.type === type) o.emit(entries);
	};

	beforeEach(() => {
		FakeObserver.instances = [];
		vi.stubGlobal("PerformanceObserver", FakeObserver);
		window.fetch = vi.fn(
			async () => new Response("ok"),
		) as unknown as typeof fetch;
	});
	afterEach(async () => {
		await active?.close();
		active = undefined;
	});

	it("la transacción de carga incluye FCP, LCP, CLS e INP", async () => {
		const { client, transactions } = boot();
		emit("paint", [{ name: "first-contentful-paint", startTime: 812.4 }]);
		emit("largest-contentful-paint", [
			{ startTime: 900 },
			{ startTime: 1432.6 },
		]);
		emit("layout-shift", [
			{ value: 0.05, hadRecentInput: false, startTime: 100 },
			{ value: 0.04, hadRecentInput: false, startTime: 400 },
			{ value: 0.5, hadRecentInput: true, startTime: 500 }, // por una acción del usuario: no cuenta
			{ value: 0.2, hadRecentInput: false, startTime: 9_000 }, // otra ventana, menor
		]);
		emit("event", [
			{ interactionId: 1, duration: 80 },
			{ interactionId: 1, duration: 120 },
			{ interactionId: 2, duration: 64 },
			{ interactionId: 0, duration: 999 }, // sin interacción: se ignora
		]);
		await vi.advanceTimersByTimeAsync(1_500);
		await client.flush();

		const m = transactions()[0].measurements ?? {};
		expect(m.fcp).toEqual({ value: 812, unit: "millisecond" });
		expect(m.lcp).toEqual({ value: 1433, unit: "millisecond" });
		expect(m.cls?.value).toBe(0.2);
		expect(m.inp).toEqual({ value: 120, unit: "millisecond" });
		expect(ingestTransactionSchema.safeParse(transactions()[0]).success).toBe(
			true,
		);
	});

	it("sin soporte del navegador no falla ni inventa medidas", async () => {
		vi.stubGlobal("PerformanceObserver", undefined);
		const { client, transactions } = boot();
		await vi.advanceTimersByTimeAsync(1_500);
		await client.flush();
		expect(transactions()).toHaveLength(1);
		expect(Object.keys(transactions()[0].measurements ?? {})).not.toContain(
			"lcp",
		);
	});
});
