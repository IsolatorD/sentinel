import { describe, expect, it } from "vitest";
import { describeMinutes } from "./duration";

describe("describeMinutes", () => {
	it("usa la unidad más grande que lo expresa de forma exacta", () => {
		expect(describeMinutes(1)).toEqual({ unit: "minutes", count: 1 });
		expect(describeMinutes(45)).toEqual({ unit: "minutes", count: 45 });
		expect(describeMinutes(60)).toEqual({ unit: "hours", count: 1 });
		expect(describeMinutes(90)).toEqual({ unit: "minutes", count: 90 });
		expect(describeMinutes(360)).toEqual({ unit: "hours", count: 6 });
		expect(describeMinutes(1440)).toEqual({ unit: "days", count: 1 });
		expect(describeMinutes(2880)).toEqual({ unit: "days", count: 2 });
		expect(describeMinutes(1500)).toEqual({ unit: "hours", count: 25 });
	});
});
