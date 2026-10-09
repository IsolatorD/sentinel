import { Controller, Get } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { HealthResponse } from "@sentinel/shared";
import { docs } from "../openapi/schemas.js";

@ApiTags("Health")
@Controller("health")
export class HealthController {
	@Get()
	@ApiOperation({ summary: "Estado del servicio" })
	@ApiOkResponse({ schema: docs.health })
	check(): HealthResponse {
		return {
			status: "ok",
			service: "api",
			timestamp: new Date().toISOString(),
		};
	}
}
