import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { AuthenticatedRequest, AuthSession } from "./auth.guard.js";

export const CurrentUser = createParamDecorator(
	(_data: unknown, context: ExecutionContext): AuthSession["user"] =>
		context.switchToHttp().getRequest<AuthenticatedRequest>().auth.user,
);
