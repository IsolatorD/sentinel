import type { AxiosAdapter, InternalAxiosRequestConfig } from "axios";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { ApiError } from "@/lib/api-error";
import { apiClient, http } from "./http";

const original = apiClient.defaults.adapter;
let requests: InternalAxiosRequestConfig[];

/** Sustituye el transporte de axios: devuelve `status` y `body` sin tocar la red. */
const respond = (status: number, body?: unknown, statusText = "") => {
	const adapter: AxiosAdapter = async (config) => {
		requests.push(config);
		return {
			data: body,
			status,
			statusText,
			headers: {},
			config,
		};
	};
	apiClient.defaults.adapter = adapter;
};

beforeEach(() => {
	requests = [];
});
afterEach(() => {
	apiClient.defaults.adapter = original;
});

describe("http", () => {
	it("envía cookies, serializa el cuerpo y valida la respuesta con el esquema", async () => {
		respond(200, { id: "1" });
		const result = await http("/api/x", {
			body: { a: 1 },
			schema: z.object({ id: z.string() }),
		});

		expect(result).toEqual({ id: "1" });
		const [request] = requests;
		expect(request.url).toBe("/api/x");
		expect(request.method).toBe("post");
		expect(request.withCredentials).toBe(true);
		expect(JSON.parse(request.data)).toEqual({ a: 1 });
		expect(request.headers.get("Content-Type")).toContain("application/json");
	});

	it("sin cuerpo usa GET", async () => {
		respond(200, {});
		await http("/api/x", { schema: z.object({}) });
		expect(requests[0].method).toBe("get");
		expect(requests[0].data).toBeUndefined();
	});

	it("arma la query ignorando valores vacíos o indefinidos", async () => {
		respond(200, {});
		await http("/api/x", {
			query: { status: "all", q: undefined, page: 2, empty: "" },
			schema: z.object({}),
		});
		expect(requests[0].params).toEqual({ status: "all", page: 2 });
	});

	it("un 204 devuelve undefined", async () => {
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
		respond(502, "<html>502</html>", "Bad Gateway");
		const error = await http("/api/x").catch((e) => e);
		expect(error).toBeInstanceOf(ApiError);
		expect(error).toMatchObject({ status: 502, message: "Bad Gateway" });
	});

	it("rechaza una respuesta que no cumple el esquema (el contrato se verifica en el cliente)", async () => {
		respond(200, { id: 123 });
		await expect(
			http("/api/x", { schema: z.object({ id: z.string() }) }),
		).rejects.toThrow();
	});

	it("un fallo de red se propaga tal cual (no es un error de la API)", async () => {
		apiClient.defaults.adapter = async () => {
			throw new Error("Network Error");
		};
		await expect(http("/api/x")).rejects.toThrow("Network Error");
	});
});
