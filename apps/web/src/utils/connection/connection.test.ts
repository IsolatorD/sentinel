import { describe, expect, it } from "vitest";
import { ApiError } from "@/utils/apiError/apiError";
import { isConnectionError } from "@/utils/connection/connection";

describe("isConnectionError", () => {
	it("un 502, 503, 504 o un estado 0 es que no se llegó al servidor", () => {
		for (const status of [0, 502, 503, 504])
			expect(isConnectionError(new ApiError(status, "Request failed"))).toBe(
				true,
			);
	});

	it("una respuesta del servidor (4xx, 500) no lo es", () => {
		for (const status of [400, 401, 403, 404, 500])
			expect(isConnectionError(new ApiError(status, "x"))).toBe(false);
	});

	it("los errores de red sin respuesta sí", () => {
		expect(isConnectionError(new Error("Network Error"))).toBe(true);
		expect(isConnectionError(new TypeError("Failed to fetch"))).toBe(true);
		expect(isConnectionError(new Error("algo más"))).toBe(false);
		expect(isConnectionError("texto")).toBe(false);
	});
});
