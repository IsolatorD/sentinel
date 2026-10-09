import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";

async function bootstrap() {
	// Aplicación standalone: sin servidor HTTP, solo procesa colas.
	const app = await NestFactory.createApplicationContext(AppModule);
	app.enableShutdownHooks();
	console.log("Worker listo, escuchando la cola 'events'");
}

bootstrap();
