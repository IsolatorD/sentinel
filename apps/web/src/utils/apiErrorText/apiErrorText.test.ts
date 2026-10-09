import { describe, expect, it } from "vitest";
import { ApiError } from "@/utils/apiError/apiError";
import { apiErrorText } from "./apiErrorText";

describe("apiErrorText", () => {
	it("muestra el mensaje de la API (ya traducido) cuando trae un código conocido", () => {
		const error = new ApiError(
			404,
			"No se encontró el issue",
			"NOT_FOUND",
			undefined,
			undefined,
			"ISSUE_NOT_FOUND",
		);
		expect(apiErrorText(error, "genérico")).toBe("No se encontró el issue");
	});

	it("si el texto no llegó, lo traduce del catálogo con el código", () => {
		const error = new ApiError(
			404,
			"",
			"NOT_FOUND",
			undefined,
			undefined,
			"ISSUE_NOT_FOUND",
		);
		expect(apiErrorText(error, "genérico")).toBe("Issue not found");
	});

	it("sin código reconocible, un error de servidor o algo que no es de la API, usa el genérico", () => {
		expect(apiErrorText(new ApiError(400, "texto suelto"), "genérico")).toBe(
			"genérico",
		);
		expect(
			apiErrorText(
				new ApiError(400, "x", "BAD", undefined, undefined, "NO_EXISTE"),
				"genérico",
			),
		).toBe("genérico");
		expect(
			apiErrorText(
				new ApiError(
					500,
					"boom",
					"INTERNAL_ERROR",
					undefined,
					undefined,
					"INTERNAL_ERROR",
				),
				"genérico",
			),
		).toBe("genérico");
		expect(apiErrorText(new Error("red"), "genérico")).toBe("genérico");
		expect(apiErrorText(undefined, "genérico")).toBe("genérico");
	});
});
