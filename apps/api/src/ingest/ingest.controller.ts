import {
	Body,
	Controller,
	HttpCode,
	Param,
	Post,
	Req,
	UseGuards,
} from "@nestjs/common";
import {
	ApiAcceptedResponse,
	ApiBody,
	ApiDefaultResponse,
	ApiOperation,
	ApiQuery,
	ApiSecurity,
	ApiTags,
} from "@nestjs/swagger";
import { type IngestEvent, ingestEventSchema } from "@sentinel/shared";
import type { FastifyRequest } from "fastify";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { docs } from "../openapi/schemas.js";
import { CountsAgainstQuota, QuotaGuard } from "../quota/quota.guard.js";
import { IngestGuard } from "./ingest.guard.js";
import { IngestService } from "./ingest.service.js";

// Endpoint público: lo llaman los SDK desde apps de terceros (CORS abierto).
@ApiTags("Ingest")
@ApiSecurity("sentinelKey")
@ApiDefaultResponse({
	description:
		"Error: 400 payload inválido, 401 clave inválida, 413 cuerpo > 1 MB, 429 límite de eventos (con `Retry-After`)",
	schema: docs.error,
})
@Controller(":projectId/events")
@UseGuards(IngestGuard, QuotaGuard)
export class IngestController {
	constructor(private readonly ingest: IngestService) {}

	@Post()
	@CountsAgainstQuota("events")
	@HttpCode(202)
	@ApiOperation({
		summary: "Envía un evento (error o mensaje)",
		description:
			"La clave de la DSN va en el header `X-Sentinel-Key` o, para `navigator.sendBeacon`, en `?sentinel_key=`. El evento se encola y se procesa de forma asíncrona.",
	})
	@ApiQuery({
		name: "sentinel_key",
		required: false,
		description: "Alternativa al header para sendBeacon",
	})
	@ApiBody({
		schema: docs.ingestEvent,
		examples: {
			exception: {
				summary: "Excepción con stacktrace",
				value: {
					level: "error",
					release: "1.4.2",
					environment: "production",
					user: { id: "u_123" },
					exception: {
						values: [
							{
								type: "TypeError",
								value: "Cannot read properties of undefined (reading 'total')",
								stacktrace: {
									frames: [
										{
											filename: "https://app.example.com/assets/Cart.js",
											function: "computeTotal",
											lineno: 42,
											colno: 17,
											in_app: true,
										},
									],
								},
							},
						],
					},
				},
			},
			message: {
				summary: "Mensaje simple",
				value: { level: "info", message: "Checkout completed" },
			},
		},
	})
	@ApiAcceptedResponse({
		description: "Evento aceptado",
		schema: docs.ingestResponse,
	})
	async capture(
		@Param("projectId") projectId: string,
		@Body(new ZodValidationPipe(ingestEventSchema)) event: IngestEvent,
		@Req() request: FastifyRequest,
	) {
		const id = await this.ingest.enqueue(projectId, event, {
			ip: request.ip,
			userAgent: request.headers["user-agent"],
		});
		return { id };
	}
}
