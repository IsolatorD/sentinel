import "reflect-metadata";
import { BadRequestException } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import {
	FastifyAdapter,
	type NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { AppModule } from "./app.module.js";

async function bootstrap() {
	const app = await NestFactory.create<NestFastifyApplication>(
		AppModule,
		new FastifyAdapter(),
		{ bodyParser: false },
	);

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

	app.setGlobalPrefix("api");
	app.enableCors({
		origin: process.env.WEB_ORIGIN ?? "http://localhost:5173",
		credentials: true,
	});

	const port = Number(process.env.API_PORT ?? 3000);
	await app.listen(port, "0.0.0.0");
	console.log(`API listening on http://localhost:${port}/api`);
}

bootstrap();
