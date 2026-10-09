import { describe, expect, it } from "vitest";
import { parseDsn } from "./dsn";

const KEY = "0123456789abcdef0123456789abcdef";
const PID = "48140d16-1ad4-4a8b-b08e-04762f0d78b9";

describe("parseDsn", () => {
	it("extrae clave, proyecto y endpoint", () => {
		expect(parseDsn(`https://${KEY}@api.example.com/${PID}`)).toEqual({
			publicKey: KEY,
			projectId: PID,
			endpoint: `https://api.example.com/api/${PID}/events`,
		});
	});

	it("conserva puerto y prefijo de ruta (detrás de un proxy)", () => {
		expect(parseDsn(`http://${KEY}@localhost:3000/${PID}`)?.endpoint).toBe(
			`http://localhost:3000/api/${PID}/events`,
		);
		expect(
			parseDsn(`https://${KEY}@example.com/sentinel/${PID}`)?.endpoint,
		).toBe(`https://example.com/sentinel/api/${PID}/events`);
	});

	it("normaliza la clave a minúsculas", () => {
		expect(
			parseDsn(`https://${KEY.toUpperCase()}@h.com/${PID}`)?.publicKey,
		).toBe(KEY);
	});

	it("devuelve null (sin lanzar) para DSN inválidas", () => {
		const invalid = [
			"",
			"no-es-una-url",
			`ftp://${KEY}@h.com/${PID}`,
			`https://h.com/${PID}`,
			`https://corta@h.com/${PID}`,
			`https://${KEY}@h.com/`,
			`https://${KEY}@h.com/no-es-uuid`,
		];
		for (const dsn of invalid) expect(parseDsn(dsn), dsn).toBeNull();
	});
});
