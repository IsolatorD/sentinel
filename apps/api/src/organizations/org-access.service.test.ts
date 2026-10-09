import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { OrgAccessService } from "./org-access.service.js";
import type { OrganizationsRepository } from "./organizations.repository.js";

const serviceWith = (role: string | undefined) =>
	new OrgAccessService({
		findMemberRole: async () => role,
	} as unknown as OrganizationsRepository);

describe("OrgAccessService.assert", () => {
	it("un no miembro recibe 404 (no se revela la organización)", async () => {
		await expect(
			serviceWith(undefined).assert("u", "o", "member"),
		).rejects.toBeInstanceOf(NotFoundException);
	});

	it("un miembro simple no alcanza el nivel admin (403)", async () => {
		await expect(
			serviceWith("member").assert("u", "o", "admin"),
		).rejects.toBeInstanceOf(ForbiddenException);
	});

	it("miembros y admins pasan según su nivel", async () => {
		await expect(
			serviceWith("member").assert("u", "o", "member"),
		).resolves.toBeUndefined();
		await expect(
			serviceWith("owner").assert("u", "o", "admin"),
		).resolves.toBeUndefined();
	});
});
