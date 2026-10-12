import { describe, expect, it } from "vitest";
import { isBreached, metricValue } from "./performance-alerts.domain.js";

const m = (sampleCount: number, p95: number | null, errors = 0) => ({
	sampleCount,
	p95,
	errors,
});

describe("metricValue", () => {
	it("el p95 viene de la medida; la tasa de errores se calcula en porcentaje", () => {
		expect(metricValue("p95_above", m(50, 1234))).toBe(1234);
		expect(metricValue("error_rate_above", m(50, 100, 5))).toBe(10);
	});

	it("sin transacciones no hay valor", () => {
		expect(metricValue("p95_above", m(0, null))).toBeNull();
		expect(metricValue("error_rate_above", m(0, null))).toBeNull();
	});
});

describe("isBreached", () => {
	it("avisa cuando el p95 supera el umbral", () => {
		expect(isBreached("p95_above", 800, m(50, 801))).toBe(true);
		expect(isBreached("p95_above", 800, m(50, 799))).toBe(false);
	});

	it("el umbral exacto no dispara el aviso", () => {
		expect(isBreached("p95_above", 800, m(50, 800))).toBe(false);
		expect(isBreached("error_rate_above", 10, m(50, 100, 5))).toBe(false);
	});

	it("avisa cuando la tasa de errores supera el umbral", () => {
		expect(isBreached("error_rate_above", 5, m(100, 100, 6))).toBe(true);
		expect(isBreached("error_rate_above", 5, m(100, 100, 4))).toBe(false);
	});

	it("con pocas muestras no avisa, por mucho que el valor sea alto", () => {
		expect(isBreached("p95_above", 800, m(9, 99_999))).toBe(false);
		expect(isBreached("error_rate_above", 5, m(9, 100, 9))).toBe(false);
		expect(isBreached("p95_above", 800, m(10, 99_999))).toBe(true);
	});
});
