import { describe, expect, it } from "vitest";
import { slugify, uniqueSlug } from "./slug";

describe("slug", () => {
	it("slugify quita acentos y símbolos", () => {
		expect(slugify("Mi Organización & Cía.")).toBe("mi-organizacion-cia");
		expect(slugify("!!!")).toBe("org");
	});

	it("uniqueSlug añade un sufijo para evitar choques", () => {
		expect(uniqueSlug("Acme")).toMatch(/^acme-[a-z0-9]{1,4}$/);
		expect(uniqueSlug("Acme")).not.toBe(uniqueSlug("Acme"));
	});
});
