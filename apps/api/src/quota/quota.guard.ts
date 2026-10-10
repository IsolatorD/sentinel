import {
	type CanActivate,
	type ExecutionContext,
	HttpException,
	HttpStatus,
	Injectable,
	SetMetadata,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { QuotaKind } from "@sentinel/shared";
import type { FastifyReply, FastifyRequest } from "fastify";
import { QuotaService } from "./quota.service.js";

const KIND = "sentinel:quota-kind";

/** Marca una ruta de ingesta con el tipo de dato que cuenta para la cuota mensual. */
export const CountsAgainstQuota = (kind: QuotaKind) => SetMetadata(KIND, kind);

/** Rechaza con 429 la ingesta de un proyecto que ya agotó su cuota mensual. Va después del `IngestGuard`. */
@Injectable()
export class QuotaGuard implements CanActivate {
	constructor(
		private readonly quota: QuotaService,
		private readonly reflector: Reflector,
	) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const kind = this.reflector.get<QuotaKind | undefined>(
			KIND,
			context.getHandler(),
		);
		if (!kind) return true;
		const http = context.switchToHttp();
		const { projectId } = http.getRequest<FastifyRequest>().params as {
			projectId: string;
		};
		const decision = await this.quota.check(projectId, kind);
		if (decision.allowed) return true;

		http
			.getResponse<FastifyReply>()
			.header("Retry-After", String(decision.retryAfterSeconds));
		throw new HttpException(
			{ reason: "QUOTA_EXCEEDED" },
			HttpStatus.TOO_MANY_REQUESTS,
		);
	}
}
