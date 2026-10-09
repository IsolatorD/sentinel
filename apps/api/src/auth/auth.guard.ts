import {
	type CanActivate,
	type ExecutionContext,
	Inject,
	Injectable,
	UnauthorizedException,
} from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { AUTH } from "./auth.constants.js";
import type { Auth } from "./auth.js";
import { toWebHeaders } from "./web-headers.js";

export type AuthSession = NonNullable<
	Awaited<ReturnType<Auth["api"]["getSession"]>>
>;
export type AuthenticatedRequest = FastifyRequest & { auth: AuthSession };

// Exige una sesión válida de Better Auth y la deja en `request.auth`.
@Injectable()
export class AuthGuard implements CanActivate {
	constructor(@Inject(AUTH) private readonly auth: Auth) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
		const session = await this.auth.api.getSession({
			headers: toWebHeaders(request.headers),
		});
		if (!session) throw new UnauthorizedException();
		request.auth = session;
		return true;
	}
}
