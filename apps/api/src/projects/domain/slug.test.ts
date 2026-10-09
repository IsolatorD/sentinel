import { describe, expect, it } from "vitest";
import { slugify, withSuffix } from "./slug.js";

describe("slugify", () => {
	it("pasa a minúsculas y separa con guiones", () => {
		expect(slugify("Mi App Web")).toBe("mi-app-web");
	});

	it("quita acentos y símbolos", () => {
		expect(slugify("Canción & Café!")).toBe("cancion-cafe");
	});

	it("recorta guiones sobrantes y limita el largo", () => {
		expect(slugify("--hola--")).toBe("hola");
		expect(slugify("a".repeat(100)).length).toBe(48);
	});

	it("usa 'project' si no queda nada utilizable", () => {
		expect(slugify("!!!")).toBe("project");
		expect(slugify("   ")).toBe("project");
	});
});

describe("withSuffix", () => {
	it("agrega un sufijo hexadecimal de 4 caracteres", () => {
		expect(withSuffix("mi-app")).toMatch(/^mi-app-[0-9a-f]{4}$/);
	});
});
