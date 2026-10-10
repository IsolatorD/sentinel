import { describe, expect, it } from "vitest";
import {
	formatMs,
	formatPercent,
	formatPerMinute,
	formatVital,
	niceMax,
	spanColor,
	vitalPosition,
} from "@/utils/performance/performance";

describe("formatMs", () => {
	it("milisegundos por debajo de 1 s, segundos por encima, un guion sin dato", () => {
		expect(formatMs(850.4, "en")).toBe("850 ms");
		expect(formatMs(1840, "en")).toBe("1.84 s");
		expect(formatMs(2000, "en")).toBe("2 s");
		expect(formatMs(1840, "es")).toBe("1,84 s");
		expect(formatMs(null, "en")).toBe("—");
		expect(formatMs(undefined, "en")).toBe("—");
	});
});

describe("otros formatos", () => {
	it("porcentaje, por minuto y vitals", () => {
		expect(formatPercent(0.125, "en")).toBe("12.5%");
		expect(formatPercent(0, "en")).toBe("0%");
		expect(formatPerMinute(0.0417, "en")).toBe("0.04");
		expect(formatPerMinute(3.456, "en")).toBe("3.5");
		expect(formatPerMinute(42.4, "en")).toBe("42");
		expect(formatVital("cls", 0.1234, "en")).toBe("0.123");
		expect(formatVital("lcp", 2100, "en")).toBe("2.1 s");
	});
});

describe("vitalPosition", () => {
	it("0–100 % sobre el doble del umbral malo, sin salirse de la barra", () => {
		expect(vitalPosition(0, 4000)).toBe(0);
		expect(vitalPosition(4000, 4000)).toBe(50);
		expect(vitalPosition(99999, 4000)).toBe(100);
	});
});

describe("niceMax", () => {
	it("redondea hacia arriba a 1, 2, 5 o 10 por una potencia de diez", () => {
		expect(niceMax(0)).toBe(1);
		expect(niceMax(730)).toBe(1000);
		expect(niceMax(1200)).toBe(2000);
		expect(niceMax(3400)).toBe(5000);
		expect(niceMax(5100)).toBe(10000);
		expect(niceMax(0.3)).toBe(0.5);
	});
});

describe("spanColor", () => {
	it("colorea por familia de operación", () => {
		expect(spanColor("http.client")).toBe("bg-info");
		expect(spanColor("db.query")).toBe("bg-success");
		expect(spanColor("ui.react.mount")).toBe("bg-primary");
		expect(spanColor("custom")).toBe("bg-muted");
	});
});
