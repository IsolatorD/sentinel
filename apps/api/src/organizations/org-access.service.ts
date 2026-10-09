import {
	ForbiddenException,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import { type AccessLevel, canAccess } from "./domain/roles.js";
import { OrganizationsRepository } from "./organizations.repository.js";

@Injectable()
export class OrgAccessService {
	constructor(private readonly orgs: OrganizationsRepository) {}

	/**
	 * Verifica que el usuario pertenezca a la organización y tenga el nivel pedido.
	 * A quien no es miembro se le responde 404 para no revelar que la organización existe.
	 */
	async assert(
		userId: string,
		organizationId: string,
		level: AccessLevel,
	): Promise<void> {
		const role = await this.orgs.findMemberRole(userId, organizationId);
		if (role === undefined)
			throw new NotFoundException("Organization not found");
		if (!canAccess(role, level)) {
			throw new ForbiddenException("Insufficient permissions");
		}
	}
}
