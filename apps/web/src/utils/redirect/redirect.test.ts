import { describe, expect, it } from "vitest";
import { safeRedirect } from "./redirect";

describe("safeRedirect", () => {
	it("acepta rutas internas, con su query", () => {
		expect(safeRedirect("/")).toBe("/");
		expect(safeRedirect("/accept-invitation/abc123")).toBe(
			"/accept-invitation/abc123",
		);
		expect(safeRedirect("/acme/projects/x/issues?status=all&q=a%20b")).toBe(
			"/acme/projects/x/issues?status=all&q=a%20b",
		);
	});

	it("rechaza lo que podría llevar a otro sitio", () => {
		for (const value of [
			"https://evil.example.com",
			"http://evil.example.com/x",
			"//evil.example.com",
			"/\\evil.example.com",
			"javascript:alert(1)",
			"evil.example.com",
			"",
			"/ok\nSet-Cookie: x=1",
		]) {
			expect(safeRedirect(value), value).toBeUndefined();
		}
	});

	it("rechaza lo que no es texto o es enorme", () => {
		for (const value of [
			undefined,
			null,
			42,
			{},
			["/a"],
			`/${"a".repeat(600)}`,
		]) {
			expect(safeRedirect(value)).toBeUndefined();
		}
	});
});
