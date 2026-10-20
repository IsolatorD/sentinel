import {
	type ArgumentsHost,
	Catch,
	type ExceptionFilter,
} from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";
import { PinoLogger } from "nestjs-pino";
import { toErrorResponse } from "./error-response.js";
import { requestLocale } from "./locale.js";
import { reportUnexpected } from "./self-monitor.js";

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
	constructor(private readonly logger: PinoLogger) {
		this.logger.setContext(AllExceptionsFilter.name);
	}

	catch(exception: unknown, host: ArgumentsHost) {
		const http = host.switchToHttp();
		const reply = http.getResponse<FastifyReply>();
		const request = http.getRequest<FastifyRequest>();
		const { status, body, unexpected } = toErrorResponse(
			exception,
			requestLocale(request.headers),
		);

		// Los 4xx ya los registra el log de peticiones; aquí solo los errores reales.
		if (unexpected) {
			this.logger.error({ err: exception }, "Unhandled exception");
			reportUnexpected(exception);
		}

		reply.status(status).send({ ...body, requestId: String(request.id) });
	}
}
