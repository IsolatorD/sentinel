import { describe, expect, it } from "vitest";
import { canAccess, parseRoles } from "./roles.js";

describe("parseRoles", () => {
	it("acepta un rol o varios separados por coma", () => {
		expect(parseRoles("owner")).toEqual(["owner"]);
		expect(parseRoles("admin, member")).toEqual(["admin", "member"]);
	});

	it("ignora roles desconocidos", () => {
		expect(parseRoles("superuser,member")).toEqual(["member"]);
	});
});

describe("canAccess", () => {
	it("cualquier miembro alcanza el nivel 'member'", () => {
		expect(canAccess("member", "member")).toBe(true);
		expect(canAccess("rol-personalizado", "member")).toBe(true);
	});

	it("solo owner o admin alcanzan el nivel 'admin'", () => {
		expect(canAccess("owner", "admin")).toBe(true);
		expect(canAccess("admin", "admin")).toBe(true);
		expect(canAccess("member,admin", "admin")).toBe(true);
		expect(canAccess("member", "admin")).toBe(false);
		expect(canAccess("rol-personalizado", "admin")).toBe(false);
	});
});
