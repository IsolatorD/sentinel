import {
	type CanActivate,
	type ExecutionContext,
	Injectable,
	UnauthorizedException,
} from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { type AuthenticatedRequest, AuthGuard } from "../auth/auth.guard.js";
import { TokensService } from "../tokens/tokens.service.js";

/** Quién sube un archivo: una persona con sesión o un token de API (CI). */
export type ArtifactActor =
	| { kind: "user"; userId: string }
	| { kind: "token"; organizationId: string };

export type ArtifactRequest = FastifyRequest & { actor: ArtifactActor };

/**
 * Subir source maps lo hace normalmente el CI, que no tiene sesión de navegador: acepta
 * `Authorization: Bearer <token>` y, si no viene, cae a la sesión (cookie) de siempre.
 */
@Injectable()
export class ArtifactAuthGuard implements CanActivate {
	constructor(
		private readonly session: AuthGuard,
		private readonly tokens: TokensService,
	) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const request = context
			.switchToHttp()
			.getRequest<ArtifactRequest & Partial<AuthenticatedRequest>>();
		const header = request.headers.authorization;

		if (header?.startsWith("Bearer ")) {
			const organizationId = await this.tokens.authenticate(
				header.slice(7).trim(),
			);
			if (!organizationId)
				throw new UnauthorizedException({ reason: "INVALID_TOKEN" });
			request.actor = { kind: "token", organizationId };
			return true;
		}

		await this.session.canActivate(context); // lanza 401 si no hay sesión
		request.actor = {
			kind: "user",
			userId: (request as AuthenticatedRequest).auth.user.id,
		};
		return true;
	}
}
