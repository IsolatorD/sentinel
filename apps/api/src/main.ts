import "reflect-metadata";
import type { IncomingMessage } from "node:http";
import type { Http2ServerRequest } from "node:http2";
import { BadRequestException } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import {
	FastifyAdapter,
	type NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { MAX_SOURCE_MAP_BYTES } from "@sentinel/shared";
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module.js";
import { resolveRequestId } from "./common/logging.js";
import { validateApiEnv } from "./config/env.js";
import { setupOpenApi } from "./openapi/openapi.setup.js";

async function bootstrap() {
	// Se carga y valida el entorno antes de crear la app: algunas opciones del
	// adaptador (trustProxy) dependen de él. Si falta algo, falla con un mensaje claro.
	try {
		process.loadEnvFile("../../.env");
	} catch {
		// En producción las variables vienen del entorno.
	}
	const env = validateApiEnv(process.env);

	const app = await NestFactory.create<NestFastifyApplication>(
		AppModule,
		new FastifyAdapter({
			bodyLimit: 1024 * 1024,
			// Detrás de un proxy/CDN, activar para que request.ip sea la IP real.
			trustProxy: env.TRUST_PROXY,
			// Mismo id que usa el log de peticiones (se comparte vía x-request-id).
			genReqId: (req: IncomingMessage | Http2ServerRequest) => {
				const id = resolveRequestId(req.headers["x-request-id"]);
				req.headers["x-request-id"] = id;
				return id;
			},
		}),
		{ bodyParser: false, bufferLogs: true },
	);
	app.useLogger(app.get(Logger));

	// bodyParser: false evita que Nest registre su propio parser JSON.
	// Fastify rechaza con 400 un JSON vacío (p. ej. un DELETE con Content-Type
	// JSON y sin cuerpo). Lo tratamos como "sin cuerpo".
	const fastify = app.getHttpAdapter().getInstance();
	fastify.removeAllContentTypeParsers();
	fastify.addContentTypeParser(
		"application/json",
		{ parseAs: "string" },
		(_req, body, done) => {
			if (body === "") return done(null, undefined);
			try {
				done(null, JSON.parse(body as string));
			} catch {
				done(new BadRequestException("Invalid JSON body"), undefined);
			}
		},
	);

	// Devuelve el id de la petición para que un cliente pueda reportar un error.
	fastify.addHook("onRequest", async (request, reply) => {
		reply.header("x-request-id", String(request.id));
	});

	// Subida de source maps: cuerpo binario con su propio límite (el JSON de la ingesta sigue en 1 MB).
	// Como la autenticación ocurre después de leer el cuerpo, el tipo binario solo se acepta en la
	// ruta de subida y solo si la petición trae credenciales: así nadie puede obligar al servidor
	// a almacenar 25 MB por petición en cualquier otro endpoint.
	const artifactUpload =
		/^\/api\/organizations\/[^/]+\/projects\/[^/]+\/releases\/[^/]+\/artifacts\/?$/;
	fastify.addHook("onRequest", async (request, reply) => {
		const contentType = request.headers["content-type"] ?? "";
		if (!contentType.startsWith("application/octet-stream")) return;
		const path = request.url.split("?", 1)[0];
		const allowed = request.method === "PUT" && artifactUpload.test(path);
		const hasCredentials = Boolean(
			request.headers.authorization || request.headers.cookie,
		);
		if (allowed && hasCredentials) return;
		const status = allowed ? 401 : 415;
		return reply.code(status).send({
			statusCode: status,
			code: status === 401 ? "UNAUTHORIZED" : "UNSUPPORTED_MEDIA_TYPE",
			message: status === 401 ? "Unauthorized" : "Unsupported media type",
			requestId: String(request.id),
		});
	});

	fastify.addContentTypeParser(
		"application/octet-stream",
		{ parseAs: "buffer", bodyLimit: MAX_SOURCE_MAP_BYTES },
		(_req, body, done) => done(null, body),
	);

	app.setGlobalPrefix("api");

	// CORS por ruta: la ingesta la llaman los SDK desde cualquier sitio (sin
	// cookies); el resto de la API solo acepta el origen del dashboard.
	const ingestPath = /^\/api\/[0-9a-f-]{36}\/events/i;
	app.enableCors({
		delegator: (req, callback) => {
			callback(
				null,
				ingestPath.test(req.url)
					? {
							origin: "*",
							methods: ["POST", "OPTIONS"],
							allowedHeaders: ["Content-Type", "X-Sentinel-Key"],
							maxAge: 86_400,
						}
					: { origin: env.WEB_ORIGIN, credentials: true },
			);
		},
	});

	if (env.ENABLE_DOCS) setupOpenApi(app);

	app.enableShutdownHooks();
	await app.listen(env.API_PORT, "0.0.0.0");
	app
		.get(Logger)
		.log(
			`API listening on http://localhost:${env.API_PORT}/api${env.ENABLE_DOCS ? " (docs: /api/docs)" : ""}`,
		);
}

bootstrap();
