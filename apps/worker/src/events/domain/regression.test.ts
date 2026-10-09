import { describe, expect, it } from "vitest";
import { nextStatusOnEvent, type ResolutionState } from "./regression.js";
import { compareSemver } from "./version.js";

const resolved = (over: Partial<ResolutionState> = {}): ResolutionState => ({
	status: "resolved",
	resolvedRelease: null,
	resolvedInclusive: false,
	...over,
});

describe("nextStatusOnEvent", () => {
	it("los issues sin resolver o ignorados no cambian", () => {
		expect(
			nextStatusOnEvent(
				{ ...resolved(), status: "unresolved" },
				"2.0.0",
				compareSemver,
			),
		).toEqual({ status: "unresolved", regressed: false });
		expect(
			nextStatusOnEvent(
				{ ...resolved(), status: "ignored" },
				"2.0.0",
				compareSemver,
			),
		).toEqual({ status: "ignored", regressed: false });
	});

	it("resuelto sin release: cualquier evento nuevo lo reabre como regresión", () => {
		expect(nextStatusOnEvent(resolved(), "1.0.0", compareSemver)).toEqual({
			status: "unresolved",
			regressed: true,
		});
		expect(nextStatusOnEvent(resolved(), undefined, compareSemver)).toEqual({
			status: "unresolved",
			regressed: true,
		});
	});

	describe("resuelto en la próxima release (baseline 2.4.0, no inclusivo)", () => {
		const state = resolved({
			resolvedRelease: "2.4.0",
			resolvedInclusive: false,
		});

		it("un evento de la misma release o de una anterior NO lo reabre", () => {
			expect(nextStatusOnEvent(state, "2.4.0", compareSemver).status).toBe(
				"resolved",
			);
			expect(nextStatusOnEvent(state, "2.3.0", compareSemver).status).toBe(
				"resolved",
			);
			expect(nextStatusOnEvent(state, "2.4.0", compareSemver).regressed).toBe(
				false,
			);
		});

		it("un evento de una release posterior lo reabre", () => {
			expect(nextStatusOnEvent(state, "2.5.0", compareSemver)).toEqual({
				status: "unresolved",
				regressed: true,
			});
			expect(nextStatusOnEvent(state, "2.4.1", compareSemver).regressed).toBe(
				true,
			);
		});
	});

	describe("resuelto en una release concreta (2.5.0, inclusivo)", () => {
		const state = resolved({
			resolvedRelease: "2.5.0",
			resolvedInclusive: true,
		});

		it("la propia release que traía la corrección también cuenta como regresión", () => {
			expect(nextStatusOnEvent(state, "2.5.0", compareSemver).regressed).toBe(
				true,
			);
			expect(nextStatusOnEvent(state, "2.6.0", compareSemver).regressed).toBe(
				true,
			);
		});

		it("las versiones anteriores a la corrección siguen sin reabrir", () => {
			expect(nextStatusOnEvent(state, "2.4.9", compareSemver).status).toBe(
				"resolved",
			);
		});
	});

	it("ante la duda se reabre: un evento sin release o con versiones incomparables", () => {
		const state = resolved({ resolvedRelease: "2.4.0" });
		expect(nextStatusOnEvent(state, undefined, compareSemver).regressed).toBe(
			true,
		);
		expect(nextStatusOnEvent(state, "abc123", compareSemver).regressed).toBe(
			true,
		);
	});
});
