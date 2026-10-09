import { Inject, Injectable } from "@nestjs/common";
import { and, type Database, eq, member } from "@sentinel/db";
import { DB } from "../database/database.module.js";

@Injectable()
export class OrganizationsRepository {
	constructor(@Inject(DB) private readonly db: Database) {}

	/** Rol (texto crudo) del usuario en la organización, o undefined si no es miembro. */
	async findMemberRole(
		userId: string,
		organizationId: string,
	): Promise<string | undefined> {
		const [row] = await this.db
			.select({ role: member.role })
			.from(member)
			.where(
				and(
					eq(member.organizationId, organizationId),
					eq(member.userId, userId),
				),
			)
			.limit(1);
		return row?.role;
	}
}
