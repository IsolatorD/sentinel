import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { ApiError } from "@/lib/api-error";
import { http } from "./http";

const respond = (status: number, body?: unknown) =>
	vi.spyOn(globalThis, "fetch").mockResolvedValue(
		new Response(body === undefined ? null : JSON.stringify(body), {
			status,
			headers: { "Content-Type": "application/json" },
		}),
	);

afterEach(() => vi.restoreAllMocks());

describe("http", () => {
	it("envía cookies, serializa el cuerpo y valida la respuesta con el esquema", async () => {
		const spy = respond(200, { id: "1" });
		const result = await http("/api/x", {
			body: { a: 1 },
			schema: z.object({ id: z.string() }),
		});

		expect(result).toEqual({ id: "1" });
		const [url, init] = spy.mock.calls[0];
		expect(url).toBe("/api/x");
		expect(init).toMatchObject({
			method: "POST",
			credentials: "include",
			body: '{"a":1}',
			headers: { "Content-Type": "application/json" },
		});
	});

	it("arma la query ignorando valores vacíos o indefinidos", async () => {
		const spy = respond(200, {});
		await http("/api/x", {
			query: { status: "all", q: undefined, page: 2, empty: "" },
			schema: z.object({}),
		});
		expect(spy.mock.calls[0][0]).toBe("/api/x?status=all&page=2");
	});

	it("un 204 devuelve undefined y no intenta leer el cuerpo", async () => {
		respond(204);
		await expect(http("/api/x", { method: "DELETE" })).resolves.toBeUndefined();
	});

	it("convierte el formato de error del backend en un ApiError con todos sus datos", async () => {
		respond(400, {
			statusCode: 400,
			code: "VALIDATION_FAILED",
			message: "Validation failed",
			issues: [{ path: "name", message: "Too small" }],
			requestId: "req-1",
		});
		const error = await http("/api/x", { body: {} }).catch((e) => e);
		expect(error).toBeInstanceOf(ApiError);
		expect(error).toMatchObject({
			status: 400,
			code: "VALIDATION_FAILED",
			message: "Validation failed",
			requestId: "req-1",
			issues: [{ path: "name" }],
		});
	});

	it("si el error no tiene el formato esperado, igual lanza un ApiError con el estado", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response("<html>502</html>", {
				status: 502,
				statusText: "Bad Gateway",
			}),
		);
		const error = await http("/api/x").catch((e) => e);
		expect(error).toMatchObject({ status: 502, message: "Bad Gateway" });
	});

	it("rechaza una respuesta que no cumple el esquema (el contrato se verifica en el cliente)", async () => {
		respond(200, { id: 123 });
		await expect(
			http("/api/x", { schema: z.object({ id: z.string() }) }),
		).rejects.toThrow();
	});
});
