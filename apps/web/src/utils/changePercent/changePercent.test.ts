import { describe, expect, it } from "vitest";
import { changePercent } from "@/utils/changePercent/changePercent";

describe("changePercent", () => {
	it("sube, baja y se queda igual", () => {
		expect(changePercent(150, 100)).toBe(50);
		expect(changePercent(50, 100)).toBe(-50);
		expect(changePercent(100, 100)).toBe(0);
		expect(changePercent(1, 3)).toBe(-66.7);
	});
	it("sin periodo anterior no hay con qué comparar", () => {
		expect(changePercent(10, 0)).toBeNull();
		expect(changePercent(0, 0)).toBeNull();
	});
});
