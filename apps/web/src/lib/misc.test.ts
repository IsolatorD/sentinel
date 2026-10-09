import { describe, expect, it } from "vitest";
import { cn } from "./cn";
import { npmSnippet, scriptTagSnippet } from "./install-snippets";
import { slugify, uniqueSlug } from "./slug";
import { readStorage, writeStorage } from "./storage";

describe("cn", () => {
	it("une clases condicionales y la última de Tailwind gana", () => {
		expect(cn("px-2", false && "hidden", "px-4")).toBe("px-4");
		expect(cn("a", undefined, ["b", { c: true, d: false }])).toBe("a b c");
	});
});

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

describe("install snippets", () => {
	const dsn = "http://key@localhost:3000/abc";
	it("incluyen la DSN en el código de configuración", () => {
		expect(npmSnippet({ dsn }).code).toContain(`dsn: "${dsn}"`);
		expect(npmSnippet({ dsn }).install).toBe("npm install @sentinel/browser");
		expect(scriptTagSnippet({ dsn })).toContain(`dsn: "${dsn}"`);
		expect(
			scriptTagSnippet({ dsn, release: "9.9.9", environment: "staging" }),
		).toContain('release: "9.9.9"');
	});
});

describe("storage", () => {
	it("lee y escribe, y nunca lanza si el almacenamiento falla", () => {
		writeStorage("k", "v");
		expect(readStorage("k")).toBe("v");
		const original = Storage.prototype.getItem;
		Storage.prototype.getItem = () => {
			throw new Error("bloqueado");
		};
		expect(readStorage("k")).toBeNull();
		Storage.prototype.getItem = original;
	});
});
