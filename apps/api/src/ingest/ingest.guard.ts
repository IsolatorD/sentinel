import {
	BadRequestException,
	type CanActivate,
	type ExecutionContext,
	HttpException,
	HttpStatus,
	Injectable,
	UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { ApiEnv } from "../config/env.js";
import { ProjectsService } from "../projects/projects.service.js";
import { RateLimiterService } from "./rate-limiter.service.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KEY = /^[0-9a-f]{32}$/;

const WINDOW_SECONDS = 60;
const MAX_AUTH_FAILURES_PER_IP = 30;

// Autentica la ingesta con la clave pública del proyecto y aplica rate limiting.
// Corre ANTES de leer y validar el cuerpo, así que un request no autorizado es barato.
@Injectable()
export class IngestGuard implements CanActivate {
	private readonly eventsPerMinute: number;

	constructor(
		private readonly projects: ProjectsService,
		private readonly limiter: RateLimiterService,
		config: ConfigService<ApiEnv, true>,
	) {
		this.eventsPerMinute = config.get("INGEST_RATE_LIMIT_PER_MINUTE", {
			infer: true,
		});
	}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const http = context.switchToHttp();
		const request = http.getRequest<FastifyRequest>();
		const reply = http.getResponse<FastifyReply>();

		const { projectId } = request.params as { projectId: string };
		if (!UUID.test(projectId))
			throw new BadRequestException("Invalid project id");

		// Header para SDK normales; query para sendBeacon, que no puede enviar headers.
		const query = request.query as { sentinel_key?: string };
		const header = request.headers["x-sentinel-key"];
		const key =
			(Array.isArray(header) ? header[0] : header) ?? query.sentinel_key;

		const valid =
			key !== undefined &&
			KEY.test(key) &&
			(await this.projects.isIngestKeyValid(projectId, key));

		if (!valid) {
			// Las claves inválidas se frenan por IP; una clave válida nunca se bloquea.
			const failures = await this.limiter.hit(
				`authfail:${request.ip}`,
				MAX_AUTH_FAILURES_PER_IP,
				WINDOW_SECONDS,
			);
			if (!failures.allowed) this.tooMany(reply, failures.retryAfterSeconds);
			throw new UnauthorizedException("Invalid key");
		}

		const result = await this.limiter.hit(
			`project:${projectId}`,
			this.eventsPerMinute,
			WINDOW_SECONDS,
		);
		if (!result.allowed) this.tooMany(reply, result.retryAfterSeconds);

		return true;
	}

	private tooMany(reply: FastifyReply, retryAfterSeconds: number): never {
		reply.header("Retry-After", String(retryAfterSeconds));
		throw new HttpException(
			"Rate limit exceeded",
			HttpStatus.TOO_MANY_REQUESTS,
		);
	}
}
