import { describe, expect, it } from "vitest";
import {
	isOverQuota,
	monthKey,
	monthStart,
	nextMonthStart,
	retryAfterSeconds,
} from "./quota.domain.js";

describe("meses", () => {
	it("el mes es en UTC, con el cero a la izquierda", () => {
		expect(monthKey(new Date("2026-03-15T10:00:00Z"))).toBe("2026-03");
		expect(monthKey(new Date("2026-12-31T23:59:59Z"))).toBe("2026-12");
		// A las 23:30 del 31 de enero en UTC-5 ya es febrero en UTC.
		expect(monthKey(new Date("2026-02-01T04:30:00Z"))).toBe("2026-02");
	});

	it("el inicio del mes y el del siguiente, también el cambio de año", () => {
		expect(monthStart(new Date("2026-10-09T12:00:00Z")).toISOString()).toBe(
			"2026-10-01T00:00:00.000Z",
		);
		expect(nextMonthStart(new Date("2026-10-09T12:00:00Z")).toISOString()).toBe(
			"2026-11-01T00:00:00.000Z",
		);
		expect(nextMonthStart(new Date("2026-12-31T23:00:00Z")).toISOString()).toBe(
			"2027-01-01T00:00:00.000Z",
		);
	});
});

describe("retryAfterSeconds", () => {
	it("a mitad de mes se limita a una hora", () => {
		expect(retryAfterSeconds(new Date("2026-10-09T12:00:00Z"))).toBe(3_600);
	});
	it("al final del mes es lo que falta para el reinicio, y nunca menos de 1", () => {
		expect(retryAfterSeconds(new Date("2026-10-31T23:59:30Z"))).toBe(30);
		expect(retryAfterSeconds(new Date("2026-10-31T23:59:59.999Z"))).toBe(1);
	});
});

describe("isOverQuota", () => {
	it("se llega al límite al alcanzarlo; sin límite, nunca", () => {
		expect(isOverQuota(99, 100)).toBe(false);
		expect(isOverQuota(100, 100)).toBe(true);
		expect(isOverQuota(1_000_000, null)).toBe(false);
	});
});
