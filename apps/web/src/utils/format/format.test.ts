import { describe, expect, it } from "vitest";
import { formatBytes } from "@/utils/format/format";

describe("formatBytes", () => {
	it("elige la unidad adecuada", () => {
		expect(formatBytes(0, "en")).toBe("0 B");
		expect(formatBytes(512, "en")).toBe("512 B");
		expect(formatBytes(1536, "en")).toBe("1.5 KB");
		expect(formatBytes(5 * 1024 * 1024, "en")).toBe("5 MB");
		expect(formatBytes(25 * 1024 * 1024 * 1024, "en")).toBe("25 GB");
	});

	it("usa el separador decimal del idioma", () => {
		expect(formatBytes(1536, "es")).toBe("1,5 KB");
	});
});
