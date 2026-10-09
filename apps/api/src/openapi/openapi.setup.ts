import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

export function setupOpenApi(app: NestFastifyApplication) {
	const config = new DocumentBuilder()
		.setTitle("Sentinel API")
		.setDescription(
			[
				"API de Sentinel, un tracker de errores y performance.",
				"",
				"- **Ingesta** (`/api/{projectId}/events`): pública, se autentica con la clave de la DSN.",
				"- **Gestión** (`/api/organizations/...`): requiere sesión (cookie de Better Auth).",
				"- **Autenticación**: rutas de Better Auth en `/api/auth/*`; su propia referencia está en `/api/auth/reference`.",
				"",
				"Todos los errores siguen el mismo formato (`ErrorResponse`).",
			].join("\n"),
		)
		.setVersion("0.1.0")
		.addCookieAuth("better-auth.session_token", undefined, "session")
		.addApiKey(
			{ type: "apiKey", name: "X-Sentinel-Key", in: "header" },
			"sentinelKey",
		)
		.build();

	const document = SwaggerModule.createDocument(app, config);
	SwaggerModule.setup("docs", app, document, {
		useGlobalPrefix: true,
		jsonDocumentUrl: "docs/openapi.json",
	});
}
