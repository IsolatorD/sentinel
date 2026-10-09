import { describe, expect, it } from "vitest";
import { looksLikeSourceMap, normalizeArtifactName } from "./source-maps.js";

describe("normalizeArtifactName", () => {
	it("quita el origen, la query y el hash, y deja '~' al inicio", () => {
		expect(
			normalizeArtifactName("https://app.example.com/assets/app.3f2a.js?v=2#x"),
		).toBe("~/assets/app.3f2a.js");
		expect(normalizeArtifactName("http://localhost:5173/src/main.js")).toBe(
			"~/src/main.js",
		);
		expect(normalizeArtifactName("/assets/app.js")).toBe("~/assets/app.js");
		expect(normalizeArtifactName("~/assets/app.js")).toBe("~/assets/app.js");
	});

	it("el mismo archivo da el mismo nombre en cualquier dominio", () => {
		expect(normalizeArtifactName("https://a.com/x/app.js")).toBe(
			normalizeArtifactName("https://cdn.b.net/x/app.js"),
		);
	});

	it("si le pasan el .map, devuelve el archivo minificado", () => {
		expect(normalizeArtifactName("~/assets/app.js.map")).toBe(
			"~/assets/app.js",
		);
		expect(normalizeArtifactName("https://a.com/app.js.map")).toBe("~/app.js");
	});

	it("rechaza nombres vacíos, relativos, con saltos de directorio o caracteres raros", () => {
		for (const bad of [
			"",
			"   ",
			"app.js",
			"../etc/passwd",
			"~/a/../../b.js",
			"~/a/./b.js",
			"~/a\\b.js",
			"~/a\u0000b.js",
			"ftp://",
			`~/${"a".repeat(600)}`,
		]) {
			expect(normalizeArtifactName(bad), JSON.stringify(bad)).toBeNull();
		}
	});
});

describe("looksLikeSourceMap", () => {
	it("acepta un mapa v3 y rechaza el resto", () => {
		expect(
			looksLikeSourceMap({ version: 3, mappings: "AAAA", sources: ["a.ts"] }),
		).toBe(true);
		expect(looksLikeSourceMap({ version: 2, mappings: "", sources: [] })).toBe(
			false,
		);
		expect(looksLikeSourceMap({ version: 3, sources: [] })).toBe(false);
		expect(looksLikeSourceMap(null)).toBe(false);
		expect(looksLikeSourceMap("texto")).toBe(false);
	});
});
