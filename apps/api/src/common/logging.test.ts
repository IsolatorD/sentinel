import { describe, expect, it } from "vitest";
import { resolveRequestId, sanitizeUrl } from "./logging.js";

describe("sanitizeUrl", () => {
	it("oculta la clave de la DSN que viaja en la query", () => {
		expect(sanitizeUrl("/api/p/events?sentinel_key=0123456789abcdef")).toBe(
			"/api/p/events?sentinel_key=[redacted]",
		);
		expect(sanitizeUrl("/x?a=1&sentinel_key=zzz&b=2")).toBe(
			"/x?a=1&sentinel_key=[redacted]&b=2",
		);
	});

	it("deja intactas las URLs sin secretos", () => {
		expect(sanitizeUrl("/api/health")).toBe("/api/health");
		expect(sanitizeUrl(undefined)).toBe("");
	});
});

describe("resolveRequestId", () => {
	it("reutiliza un id entrante válido", () => {
		expect(resolveRequestId("trace-123")).toBe("trace-123");
		expect(resolveRequestId(["abc", "def"])).toBe("abc");
	});

	it("genera uno nuevo si falta o no es seguro", () => {
		const uuid = /^[0-9a-f-]{36}$/;
		expect(resolveRequestId(undefined)).toMatch(uuid);
		expect(resolveRequestId("con espacios\nsalto")).toMatch(uuid);
		expect(resolveRequestId("x".repeat(200))).toMatch(uuid);
	});
});
