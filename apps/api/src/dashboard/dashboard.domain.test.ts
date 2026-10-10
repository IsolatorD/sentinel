import { describe, expect, it } from "vitest";
import { bucketRange } from "../issues/stats/stats.domain.js";
import {
	changePercent,
	mergeSeries,
	topWithOthers,
} from "./dashboard.domain.js";

describe("changePercent", () => {
	it("la variación respecto al periodo anterior, con un decimal", () => {
		expect(changePercent(150, 100)).toBe(50);
		expect(changePercent(50, 100)).toBe(-50);
		expect(changePercent(103, 100)).toBe(3);
		expect(changePercent(1, 3)).toBe(-66.7);
	});
	it("sin periodo anterior no hay base para comparar", () => {
		expect(changePercent(10, 0)).toBeNull();
		expect(changePercent(0, 0)).toBeNull();
	});
});

describe("mergeSeries", () => {
	const range = bucketRange(new Date("2026-10-09T15:42:00Z"), "24h");

	it("une las series de cada tabla en los mismos intervalos y completa con ceros", () => {
		const points = mergeSeries(
			[
				{ bucket: new Date("2026-10-09T15:00:00Z"), events: 7 },
				{ bucket: new Date("2026-10-09T15:00:00Z"), transactions: 30 },
				{ bucket: new Date("2026-10-09T09:00:00Z"), newIssues: 2, events: 1 },
			],
			range,
		);
		expect(points).toHaveLength(24);
		expect(points.at(-1)).toMatchObject({
			events: 7,
			transactions: 30,
			newIssues: 0,
		});
		expect(
			points.find((p) => p.start === "2026-10-09T09:00:00.000Z"),
		).toMatchObject({ events: 1, newIssues: 2, transactions: 0 });
		expect(points.reduce((n, p) => n + p.events, 0)).toBe(8);
	});

	it("ignora lo que cae fuera de la ventana", () => {
		const points = mergeSeries(
			[{ bucket: new Date("2020-01-01T00:00:00Z"), events: 99 }],
			range,
		);
		expect(points.every((p) => p.events === 0)).toBe(true);
	});
});

describe("topWithOthers", () => {
	const items = [3, 2, 1, 1].map((count, i) => ({ key: `k${i}`, count }));
	it("deja los primeros y suma el resto en otros", () => {
		expect(topWithOthers(items, 2)).toEqual([
			{ key: "k0", count: 3 },
			{ key: "k1", count: 2 },
			{ key: "other", count: 2 },
		]);
	});
	it("si caben todos, no cambia nada", () => {
		expect(topWithOthers(items, 4)).toEqual(items);
	});
});
