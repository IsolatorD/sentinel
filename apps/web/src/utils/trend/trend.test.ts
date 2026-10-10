import { describe, expect, it } from "vitest";
import { barHeights, formatBucket } from "@/utils/trend/trend";

describe("barHeights", () => {
	it("escala respecto al máximo", () => {
		expect(barHeights([0, 5, 10])).toEqual([0, 0.5, 1]);
	});
	it("sin eventos todas valen 0", () => {
		expect(barHeights([0, 0])).toEqual([0, 0]);
		expect(barHeights([])).toEqual([]);
	});
});

describe("formatBucket", () => {
	it("los intervalos de un día muestran solo la fecha", () => {
		const label = formatBucket("2026-10-09T00:00:00.000Z", 1440, "en");
		expect(label).toContain("Oct 9, 2026");
		expect(label).not.toMatch(/\d:\d\d/);
	});
	it("los más cortos incluyen la hora", () => {
		expect(formatBucket("2026-10-09T12:00:00.000Z", 60, "en")).toMatch(
			/\d:\d\d/,
		);
	});
});
