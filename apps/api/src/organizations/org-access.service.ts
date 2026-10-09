import {
	ForbiddenException,
	Inject,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import { and, type Database, eq, member } from "@sentinel/db";
import { DB } from "../database/database.module.js";

export type OrgRole = "owner" | "admin" | "member";

// Better Auth guarda los roles como texto; varios roles van separados por coma.
function parseRoles(raw: string): OrgRole[] {
	return raw
		.split(",")
		.map((r) => r.trim())
		.filter((r): r is OrgRole => ["owner", "admin", "member"].includes(r));
}

@Injectable()
export class OrgAccessService {
	constructor(@Inject(DB) private readonly db: Database) {}

	/**
	 * Verifica que el usuario pertenezca a la organización y tenga el nivel pedido.
	 * - "member": cualquier miembro. - "admin": owner o admin.
	 * A quien no es miembro se le responde 404 para no revelar que la organización existe.
	 */
	async assert(
		userId: string,
		organizationId: string,
		level: "member" | "admin",
	): Promise<OrgRole[]> {
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

		if (!row) throw new NotFoundException("Organization not found");

		const roles = parseRoles(row.role);
		if (
			level === "admin" &&
			!roles.some((r) => r === "owner" || r === "admin")
		) {
			throw new ForbiddenException("Insufficient permissions");
		}
		return roles;
	}
}
