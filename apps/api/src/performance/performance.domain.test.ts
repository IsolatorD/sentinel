import { describe, expect, it } from "vitest";
import { bucketRange } from "../issues/stats/stats.domain.js";
import {
	buildWaterfall,
	errorRate,
	fillSeries,
	type SpanRow,
	summarizeVitals,
	throughputPerMinute,
	toMs,
} from "./performance.domain.js";

describe("métricas básicas", () => {
	it("errorRate: fracción, y 0 sin transacciones", () => {
		expect(errorRate(1, 4)).toBe(0.25);
		expect(errorRate(0, 0)).toBe(0);
	});
	it("throughput por minuto sobre todo el periodo", () => {
		expect(throughputPerMinute(1440, "24h")).toBe(1);
		expect(throughputPerMinute(60, "24h")).toBeCloseTo(0.0417, 3);
		expect(throughputPerMinute(7 * 24 * 60, "7d")).toBe(1);
	});
	it("toMs redondea a 2 decimales y tolera null y texto", () => {
		expect(toMs("12.3456")).toBe(12.35);
		expect(toMs(null)).toBeNull();
		expect(toMs(undefined)).toBeNull();
		expect(toMs("abc")).toBeNull();
	});
});

describe("fillSeries", () => {
	const range = bucketRange(new Date("2026-10-09T15:42:00Z"), "24h");
	it("completa los intervalos vacíos con 0 y percentiles nulos", () => {
		const points = fillSeries([], range);
		expect(points).toHaveLength(24);
		expect(points[0]).toMatchObject({
			count: 0,
			errors: 0,
			p50: null,
			p95: null,
		});
	});
	it("coloca cada fila en su intervalo", () => {
		const points = fillSeries(
			[
				{
					bucket: new Date("2026-10-09T15:00:00Z"),
					count: 5,
					errors: 1,
					p50: 100,
					p95: 400,
				},
			],
			range,
		);
		expect(points.at(-1)).toMatchObject({
			count: 5,
			errors: 1,
			p50: 100,
			p95: 400,
		});
		expect(points.reduce((n, p) => n + p.count, 0)).toBe(5);
	});
});

describe("summarizeVitals", () => {
	it("valora cada vital y omite los que no tienen muestras", () => {
		const out = summarizeVitals([
			{ vital: "lcp", p75: 1800, samples: 10 },
			{ vital: "cls", p75: 0.3, samples: 4 },
			{ vital: "inp", p75: 300, samples: 2 },
			{ vital: "fcp", p75: null, samples: 0 },
		]);
		expect(out.lcp).toEqual({ p75: 1800, samples: 10, rating: "good" });
		expect(out.cls?.rating).toBe("poor");
		expect(out.inp?.rating).toBe("needs-improvement");
		expect(out.fcp).toBeUndefined();
		expect(out.ttfb).toBeUndefined();
	});
});

describe("buildWaterfall", () => {
	const span = (over: Partial<SpanRow> & { spanId: string }): SpanRow => ({
		parentSpanId: null,
		op: "x",
		description: null,
		startMs: 1_000,
		durationMs: 10,
		status: null,
		data: null,
		...over,
	});

	it("calcula el desfase respecto a la transacción y ordena por inicio", () => {
		const out = buildWaterfall(1_000, [
			span({ spanId: "b", startMs: 1_300 }),
			span({ spanId: "a", startMs: 1_100 }),
		]);
		expect(out.map((s) => [s.spanId, s.offsetMs])).toEqual([
			["a", 100],
			["b", 300],
		]);
	});

	it("anida según el padre; sin padre conocido cuelga de la transacción", () => {
		const out = buildWaterfall(1_000, [
			span({ spanId: "a", startMs: 1_000 }),
			span({ spanId: "b", parentSpanId: "a", startMs: 1_010 }),
			span({ spanId: "c", parentSpanId: "b", startMs: 1_020 }),
			span({ spanId: "d", parentSpanId: "desconocido", startMs: 1_030 }),
		]);
		expect(Object.fromEntries(out.map((s) => [s.spanId, s.depth]))).toEqual({
			a: 1,
			b: 2,
			c: 3,
			d: 1,
		});
	});

	it("un span que empieza antes que la transacción no da desfase negativo", () => {
		expect(
			buildWaterfall(1_000, [span({ spanId: "a", startMs: 900 })])[0].offsetMs,
		).toBe(0);
	});

	it("un ciclo de padres (datos corruptos) no cuelga el cálculo", () => {
		const out = buildWaterfall(0, [
			span({ spanId: "a", parentSpanId: "b" }),
			span({ spanId: "b", parentSpanId: "a" }),
		]);
		expect(out).toHaveLength(2);
	});
});
