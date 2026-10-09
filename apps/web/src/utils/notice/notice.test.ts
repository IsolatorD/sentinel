import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "@/i18n";
import { noticeText, notify, showNotice, withoutPlaceholders } from "./notice";

const headers = (values: Record<string, string>) => ({
	get: (name: string) => values[name.toLowerCase()],
});

// El módulo ya lo cargó la configuración de pruebas: se espía el `toast` real en lugar de simularlo.
const success = vi.spyOn(toast, "success").mockImplementation(() => "id");

beforeEach(() => success.mockClear());
afterEach(async () => {
	await i18n.changeLanguage("en");
});

describe("noticeText", () => {
	it("usa el texto que manda la API, decodificado", () => {
		const text = encodeURIComponent("Proyecto «Tienda ñandú» creado");
		expect(noticeText(headers({ "x-sentinel-message": text }))).toBe(
			"Proyecto «Tienda ñandú» creado",
		);
	});

	it("sin texto pero con código, traduce del catálogo en el idioma de la interfaz", async () => {
		expect(
			noticeText(
				headers({ "x-sentinel-message-code": "NOTICE_PROJECT_UPDATED" }),
			),
		).toBe("Project updated");
		await i18n.changeLanguage("es");
		expect(
			noticeText(
				headers({ "x-sentinel-message-code": "NOTICE_PROJECT_UPDATED" }),
			),
		).toBe("Proyecto actualizado");
	});

	it("un texto mal codificado cae al código", () => {
		expect(
			noticeText(
				headers({
					"x-sentinel-message": "%E0%A4%A",
					"x-sentinel-message-code": "NOTICE_KEY_DELETED",
				}),
			),
		).toBe("Key deleted");
	});

	it("un código inventado o ninguna cabecera no dan texto", () => {
		expect(
			noticeText(headers({ "x-sentinel-message-code": "NOPE" })),
		).toBeUndefined();
		expect(noticeText(headers({}))).toBeUndefined();
	});

	it("también lee cabeceras de un objeto plano (axios las normaliza así)", () => {
		expect(
			noticeText({ "x-sentinel-message": encodeURIComponent("Hecho") }),
		).toBe("Hecho");
	});
});

describe("withoutPlaceholders", () => {
	it("quita los valores que faltan y lo que los rodeaba", () => {
		expect(withoutPlaceholders("Project “{{name}}” created")).toBe(
			"Project created",
		);
		expect(withoutPlaceholders("Issue assigned to {{name}}")).toBe(
			"Issue assigned to",
		);
		expect(withoutPlaceholders("Sin valores")).toBe("Sin valores");
	});
});

describe("showNotice", () => {
	it("muestra el aviso de una respuesta correcta", () => {
		showNotice(
			201,
			headers({ "x-sentinel-message": encodeURIComponent("Creado") }),
		);
		expect(success).toHaveBeenCalledWith("Creado");
	});

	it("no muestra nada si la respuesta fue un error o no trae aviso", () => {
		showNotice(
			400,
			headers({ "x-sentinel-message": encodeURIComponent("No debería") }),
		);
		showNotice(200, headers({}));
		expect(success).not.toHaveBeenCalled();
	});
});

describe("notify", () => {
	it("muestra un aviso propio del panel", () => {
		notify("Listo");
		expect(success).toHaveBeenCalledWith("Listo");
	});
});
