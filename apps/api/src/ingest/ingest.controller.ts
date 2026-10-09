import {
	Body,
	Controller,
	HttpCode,
	Param,
	Post,
	Req,
	UseGuards,
} from "@nestjs/common";
import { type IngestEvent, ingestEventSchema } from "@sentinel/shared";
import type { FastifyRequest } from "fastify";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { IngestGuard } from "./ingest.guard.js";
import { IngestService } from "./ingest.service.js";

// Endpoint público: lo llaman los SDK desde apps de terceros (CORS abierto).
@Controller(":projectId/events")
@UseGuards(IngestGuard)
export class IngestController {
	constructor(private readonly ingest: IngestService) {}

	@Post()
	@HttpCode(202)
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
