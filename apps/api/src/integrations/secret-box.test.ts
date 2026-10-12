import { describe, expect, it } from "vitest";
import { SecretBox } from "./secret-box.js";

const box = new SecretBox("a-long-server-secret-for-tests-0123456789");

describe("SecretBox", () => {
	it("descifra lo que cifró", () => {
		const token = "ATATT3xFfGF0-secret/token+with=chars";
		expect(box.decrypt(box.encrypt(token))).toBe(token);
	});

	it("no guarda el texto en claro, y cada cifrado es distinto", () => {
		const a = box.encrypt("secret-token");
		const b = box.encrypt("secret-token");
		expect(a).not.toContain("secret-token");
		expect(a).not.toBe(b);
	});

	it("rechaza un texto alterado", () => {
		const parts = box.encrypt("secret-token").split(".");
		parts[3] = Buffer.from("tampered").toString("base64");
		expect(() => box.decrypt(parts.join("."))).toThrow();
	});

	it("rechaza lo cifrado con otro secreto (por ejemplo, tras rotar el del servidor)", () => {
		const other = new SecretBox("another-secret-0123456789-abcdefghij");
		expect(() => box.decrypt(other.encrypt("x"))).toThrow();
	});

	it("rechaza formatos desconocidos", () => {
		expect(() => box.decrypt("plain-text")).toThrow();
		expect(() => box.decrypt("v9.a.b.c")).toThrow();
	});
});
