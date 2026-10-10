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
import {
	type IngestTransaction,
	ingestTransactionSchema,
} from "@sentinel/shared";
import type { FastifyRequest } from "fastify";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { docs } from "../openapi/schemas.js";
import { CountsAgainstQuota, QuotaGuard } from "../quota/quota.guard.js";
import { IngestGuard } from "./ingest.guard.js";
import { TransactionsService } from "./transactions.service.js";

// Endpoint público, como el de eventos: mismas claves, mismo límite por proyecto y mismo CORS.
@ApiTags("Ingest")
@ApiSecurity("sentinelKey")
@ApiDefaultResponse({
	description:
		"Error: 400 payload inválido, 401 clave inválida, 413 cuerpo > 1 MB, 429 límite (con `Retry-After`)",
	schema: docs.error,
})
@Controller(":projectId/transactions")
@UseGuards(IngestGuard, QuotaGuard)
export class TransactionsController {
	constructor(private readonly transactions: TransactionsService) {}

	@Post()
	@CountsAgainstQuota("transactions")
	@HttpCode(202)
	@ApiOperation({
		summary: "Envía una transacción (medida de rendimiento) con sus spans",
		description:
			"La clave de la DSN va en el header `X-Sentinel-Key` o, para `navigator.sendBeacon`, en `?sentinel_key=`. Se encola y se procesa de forma asíncrona.",
	})
	@ApiQuery({
		name: "sentinel_key",
		required: false,
		description: "Alternativa al header para sendBeacon",
	})
	@ApiBody({
		schema: docs.ingestTransaction,
		examples: {
			pageload: {
				summary: "Carga de página con un span y Web Vitals",
				value: {
					trace_id: "4bf92f3577b34da6a3ce929d0e0e4736",
					span_id: "00f067aa0ba902b7",
					name: "/checkout",
					op: "pageload",
					duration_ms: 1840,
					release: "1.4.2",
					environment: "production",
					measurements: {
						lcp: { value: 1620, unit: "millisecond" },
						cls: { value: 0.04 },
					},
					spans: [
						{
							span_id: "b9c7c989f97918e1",
							parent_span_id: "00f067aa0ba902b7",
							op: "http.client",
							description: "GET /api/cart",
							start_timestamp: 1760000000.2,
							duration_ms: 320,
						},
					],
				},
			},
		},
	})
	@ApiAcceptedResponse({
		description: "Transacción aceptada",
		schema: docs.ingestResponse,
	})
	async capture(
		@Param("projectId") projectId: string,
		@Body(new ZodValidationPipe(ingestTransactionSchema))
		transaction: IngestTransaction,
		@Req() request: FastifyRequest,
	) {
		const id = await this.transactions.enqueue(projectId, transaction, {
			ip: request.ip,
			userAgent: request.headers["user-agent"],
		});
		return { id };
	}
}
