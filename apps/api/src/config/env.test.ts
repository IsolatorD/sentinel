import { describe, expect, it } from "vitest";
import { validateApiEnv } from "./env.js";

const valid = {
	DATABASE_URL: "postgresql://u:p@localhost:5432/db",
	BETTER_AUTH_SECRET: "a-secret-with-enough-length",
};

describe("validateApiEnv", () => {
	it("aplica valores por defecto y deriva las URLs", () => {
		const env = validateApiEnv(valid);
		expect(env).toMatchObject({
			API_PORT: 3000,
			REDIS_PORT: 6379,
			WEB_ORIGIN: "http://localhost:5173",
			INGEST_RATE_LIMIT_PER_MINUTE: 600,
			TRUST_PROXY: false,
			BETTER_AUTH_URL: "http://localhost:3000",
			PUBLIC_API_URL: "http://localhost:3000",
			ENABLE_DOCS: true,
		});
	});

	it("convierte strings numéricos y booleanos", () => {
		const env = validateApiEnv({
			...valid,
			API_PORT: "4000",
			TRUST_PROXY: "true",
			NODE_ENV: "production",
		});
		expect(env.API_PORT).toBe(4000);
		expect(env.TRUST_PROXY).toBe(true);
		// En producción la documentación no se publica por defecto.
		expect(env.ENABLE_DOCS).toBe(false);
		expect(env.BETTER_AUTH_URL).toBe("http://localhost:4000");
	});

	it("trata las variables vacías como ausentes", () => {
		const env = validateApiEnv({
			...valid,
			GOOGLE_CLIENT_ID: "",
			GOOGLE_CLIENT_SECRET: "",
			PUBLIC_API_URL: "",
		});
		expect(env.GOOGLE_CLIENT_ID).toBeUndefined();
		expect(env.PUBLIC_API_URL).toBe("http://localhost:3000");
	});

	it("falla con un mensaje claro si falta algo o es inválido", () => {
		expect(() => validateApiEnv({})).toThrow(/DATABASE_URL/);
		expect(() =>
			validateApiEnv({ ...valid, BETTER_AUTH_SECRET: "corto" }),
		).toThrow(/BETTER_AUTH_SECRET.*16/);
		expect(() => validateApiEnv({ ...valid, API_PORT: "abc" })).toThrow(
			/API_PORT/,
		);
	});

	it("exige las credenciales de Google en pareja", () => {
		expect(() =>
			validateApiEnv({ ...valid, GOOGLE_CLIENT_ID: "solo-id" }),
		).toThrow(/GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET/);
	});
});
