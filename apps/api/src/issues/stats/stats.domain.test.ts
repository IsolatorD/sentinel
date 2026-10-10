import { describe, expect, it } from "vitest";
import { bucketRange, fillBuckets } from "./stats.domain.js";

const at = (iso: string) => new Date(iso);

describe("bucketRange", () => {
	it("24 h: 24 intervalos de una hora que terminan en la hora actual", () => {
		const range = bucketRange(at("2026-10-09T15:42:10Z"), "24h");
		expect(range.count).toBe(24);
		expect(range.bucketMs).toBe(3_600_000);
		expect(range.from.toISOString()).toBe("2026-10-08T16:00:00.000Z");
		expect(range.to.toISOString()).toBe("2026-10-09T15:42:10.000Z");
	});

	it("7 d: intervalos de 6 horas alineados a las 00, 06, 12 y 18 UTC", () => {
		const range = bucketRange(at("2026-10-09T15:42:10Z"), "7d");
		expect(range.count).toBe(28);
		expect(range.bucketMs).toBe(6 * 3_600_000);
		expect(range.from.getUTCHours() % 6).toBe(0);
		// El último intervalo es el de las 12:00 (el que contiene las 15:42).
		const last = range.from.getTime() + (range.count - 1) * range.bucketMs;
		expect(new Date(last).toISOString()).toBe("2026-10-09T12:00:00.000Z");
	});

	it("30 d: intervalos de un día alineados a medianoche UTC", () => {
		const range = bucketRange(at("2026-10-09T23:59:59Z"), "30d");
		expect(range.count).toBe(30);
		expect(range.from.toISOString()).toBe("2026-09-10T00:00:00.000Z");
	});

	it("justo en el límite de un intervalo, ese intervalo empieza ahí", () => {
		const range = bucketRange(at("2026-10-09T15:00:00Z"), "24h");
		const last = range.from.getTime() + (range.count - 1) * range.bucketMs;
		expect(new Date(last).toISOString()).toBe("2026-10-09T15:00:00.000Z");
	});
});

describe("fillBuckets", () => {
	const range = bucketRange(at("2026-10-09T15:42:00Z"), "24h");

	it("devuelve todos los intervalos, con ceros donde no hubo eventos", () => {
		const points = fillBuckets([], range);
		expect(points).toHaveLength(24);
		expect(points.every((p) => p.events === 0 && p.users === 0)).toBe(true);
		expect(points[0].start).toBe("2026-10-08T16:00:00.000Z");
		expect(points[23].start).toBe("2026-10-09T15:00:00.000Z");
	});

	it("coloca cada fila en su intervalo y mantiene el orden", () => {
		const points = fillBuckets(
			[
				{ bucket: at("2026-10-09T15:00:00Z"), events: 7, users: 3 },
				{ bucket: at("2026-10-09T09:00:00Z"), events: 2, users: 2 },
			],
			range,
		);
		expect(
			points.find((p) => p.start === "2026-10-09T15:00:00.000Z"),
		).toMatchObject({ events: 7, users: 3 });
		expect(
			points.find((p) => p.start === "2026-10-09T09:00:00.000Z"),
		).toMatchObject({ events: 2, users: 2 });
		expect(points.map((p) => p.start)).toEqual(
			[...points.map((p) => p.start)].sort(),
		);
		expect(points.reduce((sum, p) => sum + p.events, 0)).toBe(9);
	});

	it("ignora filas que caen fuera de la ventana", () => {
		const points = fillBuckets(
			[{ bucket: at("2020-01-01T00:00:00Z"), events: 99, users: 9 }],
			range,
		);
		expect(points.reduce((sum, p) => sum + p.events, 0)).toBe(0);
	});
});
