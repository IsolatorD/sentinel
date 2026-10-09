import { describe, expect, it } from "vitest";
import { formatCompact, formatRelative } from "./time";

const NOW = new Date("2026-10-09T12:00:00Z").getTime();
const minutesAgo = (m: number) => new Date(NOW - m * 60_000);

describe("formatRelative", () => {
	it("elige la unidad adecuada, en el idioma pedido", () => {
		expect(formatRelative(minutesAgo(0.2), "en", NOW)).toBe("12 seconds ago");
		expect(formatRelative(minutesAgo(5), "en", NOW)).toBe("5 minutes ago");
		expect(formatRelative(minutesAgo(180), "en", NOW)).toBe("3 hours ago");
		expect(formatRelative(minutesAgo(60 * 24 * 3), "en", NOW)).toBe(
			"3 days ago",
		);
		expect(formatRelative(minutesAgo(5), "es", NOW)).toBe("hace 5 minutos");
	});

	it("acepta strings ISO y fechas futuras", () => {
		expect(formatRelative(minutesAgo(60).toISOString(), "en", NOW)).toBe(
			"1 hour ago",
		);
		expect(formatRelative(new Date(NOW + 2 * 3600_000), "en", NOW)).toBe(
			"in 2 hours",
		);
	});
});

describe("formatCompact", () => {
	it("abrevia los números grandes", () => {
		expect(formatCompact(950, "en")).toBe("950");
		expect(formatCompact(1200, "en")).toBe("1.2K");
		expect(formatCompact(3_400_000, "en")).toBe("3.4M");
	});
});
