import { describe, expect, it } from "vitest";
import { maskUrl } from "./mask-url.js";

describe("maskUrl", () => {
	it("muestra el origen y solo los últimos 4 caracteres", () => {
		expect(
			maskUrl("https://hooks.slack.com/services/T000/B000/XXXXsecretYYYY"),
		).toBe("https://hooks.slack.com/…YYYY");
	});

	it("no revela nada de rutas cortas", () => {
		expect(maskUrl("https://example.com/hook")).toBe("https://example.com/…");
		expect(maskUrl("https://example.com")).toBe("https://example.com/…");
	});

	it("tampoco deja ver el token de la query", () => {
		const masked = maskUrl("https://example.com/h?token=supersecretvalue");
		expect(masked).not.toContain("supersecret");
	});

	it("no lanza con una URL inválida", () => {
		expect(maskUrl("no es url")).toBe("…");
	});
});
