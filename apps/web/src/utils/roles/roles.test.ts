import { describe, expect, it } from "vitest";
import { isAdminRole } from "./roles";

describe("isAdminRole", () => {
	it("owner y admin gestionan; member no", () => {
		expect(isAdminRole("owner")).toBe(true);
		expect(isAdminRole("admin")).toBe(true);
		expect(isAdminRole("member")).toBe(false);
	});

	it("con varios roles basta uno que gestione, y tolera espacios", () => {
		expect(isAdminRole("member, admin")).toBe(true);
		expect(isAdminRole("member,member")).toBe(false);
		expect(isAdminRole("")).toBe(false);
	});
});
