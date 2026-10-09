import "reflect-metadata";
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
