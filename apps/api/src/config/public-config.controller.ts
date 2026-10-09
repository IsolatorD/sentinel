import { Controller, Get } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { PublicConfig } from "@sentinel/shared";
import { docs } from "../openapi/schemas.js";
import type { ApiEnv } from "./env.js";

@ApiTags("Config")
@Controller("config")
export class PublicConfigController {
	constructor(private readonly config: ConfigService<ApiEnv, true>) {}

	@Get()
	@ApiOperation({
		summary: "Configuración pública",
		description:
			"Qué proveedores de inicio de sesión están disponibles. No expone secretos.",
	})
	@ApiOkResponse({ schema: docs.publicConfig })
	get(): PublicConfig {
		return {
			authProviders: {
				google: Boolean(this.config.get("GOOGLE_CLIENT_ID", { infer: true })),
			},
			emailEnabled: Boolean(this.config.get("SMTP_URL", { infer: true })),
			emailVerification:
				Boolean(this.config.get("SMTP_URL", { infer: true })) &&
				this.config.get("REQUIRE_EMAIL_VERIFICATION", { infer: true }),
		};
	}
}
