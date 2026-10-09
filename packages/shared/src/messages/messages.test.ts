import { describe, expect, it } from "vitest";
import { isLocale, parseAcceptLanguage } from "../locale.js";
import { en } from "./en.js";
import { es } from "./es.js";
import { isMessageCode, MESSAGES, translate } from "./index.js";

const placeholders = (text: string) =>
	[...text.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort();

describe("catálogo de mensajes", () => {
	it("todos los idiomas tienen exactamente los mismos códigos", () => {
		expect(Object.keys(es).sort()).toEqual(Object.keys(en).sort());
	});

	it("cada traducción usa los mismos {{valores}} que el original", () => {
		for (const code of Object.keys(en) as Array<keyof typeof en>) {
			expect(placeholders(es[code]), code).toEqual(placeholders(en[code]));
		}
	});

	it("ningún texto está vacío ni se quedó sin traducir por descuido", () => {
		for (const [locale, messages] of Object.entries(MESSAGES)) {
			for (const [code, text] of Object.entries(messages)) {
				expect(text.trim().length, `${locale}.${code}`).toBeGreaterThan(0);
			}
		}
	});
});

describe("translate", () => {
	it("sustituye los valores", () => {
		expect(translate("en", "NOTICE_PROJECT_CREATED", { name: "Acme" })).toBe(
			"Project “Acme” created",
		);
		expect(translate("es", "NOTICE_ISSUE_ASSIGNED", { name: "Ana" })).toBe(
			"Issue asignado a Ana",
		);
	});

	it("un valor que falta se deja visible en lugar de borrarse", () => {
		expect(translate("en", "NOTICE_ISSUE_ASSIGNED")).toBe(
			"Issue assigned to {{name}}",
		);
	});

	it("los números se convierten a texto y un código inventado no pasa por válido", () => {
		expect(translate("en", "EMAIL_UNIT_MINUTE_OTHER", { count: 5 })).toBe(
			"5 minutes",
		);
		expect(isMessageCode("ISSUE_NOT_FOUND")).toBe(true);
		expect(isMessageCode("constructor")).toBe(false);
		expect(isMessageCode("NOPE")).toBe(false);
	});
});

describe("parseAcceptLanguage", () => {
	it("elige el primer idioma soportado por prioridad", () => {
		expect(parseAcceptLanguage("es-AR,es;q=0.9,en;q=0.8")).toBe("es");
		expect(parseAcceptLanguage("fr-FR,fr;q=0.9,en;q=0.5")).toBe("en");
		expect(parseAcceptLanguage("en;q=0.4,es;q=0.9")).toBe("es");
		expect(parseAcceptLanguage("EN-us")).toBe("en");
	});

	it("sin cabecera, vacía o sin ningún idioma soportado, usa el inglés", () => {
		for (const header of [undefined, null, "", "fr,de;q=0.7", "*", "es;q=0"]) {
			expect(parseAcceptLanguage(header), String(header)).toBe("en");
		}
	});

	it("tolera basura sin lanzar", () => {
		expect(parseAcceptLanguage(";;;,,q=")).toBe("en");
		expect(parseAcceptLanguage("es;q=abc")).toBe("en");
	});
});

describe("isLocale", () => {
	it("solo reconoce los idiomas soportados", () => {
		expect(isLocale("es")).toBe(true);
		expect(isLocale("fr")).toBe(false);
		expect(isLocale(undefined)).toBe(false);
	});
});
