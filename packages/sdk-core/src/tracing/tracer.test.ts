import { describe, expect, it } from "vitest";
import { Tracer, type TracerConfig } from "./tracer";
import type { Transaction } from "./transaction";

function make(over: Partial<TracerConfig> = {}) {
	const finished: Transaction[] = [];
	const tracer = new Tracer(
		{
			sampleRate: 1,
			http: true,
			maxSpans: 100,
			idleTimeoutMs: 0,
			finalTimeoutMs: 0,
			...over,
		},
		{ onFinish: (tx) => finished.push(tx) },
	);
	return { tracer, finished };
}

describe("Tracer (núcleo)", () => {
	it("continúa una traza de fuera: mismo trace_id y span padre", () => {
		const { tracer, finished } = make();
		const tx = tracer.startTransaction({
			name: "GET /x",
			traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
			parentSpanId: "00f067aa0ba902b7",
		});
		tx.finish();
		expect(tx.traceId).toBe("4bf92f3577b34da6a3ce929d0e0e4736");
		expect(tx.parentSpanId).toBe("00f067aa0ba902b7");
		expect(finished).toEqual([tx]);
	});

	it("`sampled` explícito manda sobre sampleRate (se respeta a quien originó la traza)", () => {
		const off = make({ sampleRate: 0 });
		expect(
			off.tracer.startTransaction({ name: "a", sampled: true }).sampled,
		).toBe(true);
		const on = make({ sampleRate: 1 });
		const tx = on.tracer.startTransaction({ name: "a", sampled: false });
		tx.finish();
		expect(tx.sampled).toBe(false);
		expect(on.finished).toHaveLength(0);
	});

	it("runTransaction solo deja la transacción como activa dentro de la función", () => {
		const { tracer } = make();
		expect(tracer.active).toBeUndefined();
		tracer.runTransaction({ name: "a" }, (tx) => {
			expect(tracer.active).toBe(tx);
		});
	});

	it("por defecto no propaga traceparent; solo a las URLs de propagationTargets", () => {
		const a = make();
		a.tracer.startTransaction({ name: "t" });
		expect(
			a.tracer.startHttpSpan({ method: "GET", url: "https://api.other.com/x" })
				?.headers,
		).toBeUndefined();

		const b = make({ propagationTargets: ["api.other.com"] });
		const tx = b.tracer.startTransaction({ name: "t" });
		const handle = b.tracer.startHttpSpan({
			method: "GET",
			url: "https://api.other.com/x?token=1",
		});
		expect(handle?.headers?.traceparent).toMatch(
			new RegExp(`^00-${tx.traceId}-[0-9a-f]{16}-01$`),
		);
		handle?.end(200);
		expect(tx.spans[0].description).toBe("GET https://api.other.com/x");
	});

	it("isInApp: los módulos internos de Node no son código de la app", async () => {
		const { isInApp } = await import("../stacktrace");
		expect(isInApp("node:internal/process/task_queues")).toBe(false);
		expect(isInApp("/srv/app/node_modules/express/lib/router.js")).toBe(false);
		expect(isInApp("/srv/app/dist/server.js")).toBe(true);
		expect(isInApp("file:///srv/app/dist/server.js")).toBe(true);
	});
});
