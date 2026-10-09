import { describe, expect, it } from "vitest";
import { buildDsn } from "./dsn.js";
import { generatePublicKey } from "./public-key.js";

describe("buildDsn", () => {
	it("arma <protocolo>://<clave>@<host>/<projectId>", () => {
		expect(buildDsn("https://api.example.com", "abc123", "proj-1")).toBe(
			"https://abc123@api.example.com/proj-1",
		);
	});

	it("conserva el puerto y descarta la ruta", () => {
		expect(buildDsn("http://localhost:3000/api", "k", "p")).toBe(
			"http://k@localhost:3000/p",
		);
	});
});

describe("generatePublicKey", () => {
	it("genera 32 caracteres hexadecimales distintos cada vez", () => {
		const a = generatePublicKey();
		const b = generatePublicKey();
		expect(a).toMatch(/^[0-9a-f]{32}$/);
		expect(a).not.toBe(b);
	});
});
