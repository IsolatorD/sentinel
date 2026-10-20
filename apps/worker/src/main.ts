import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module.js";
import { validateWorkerEnv } from "./config/env.js";
import { startSelfMonitor } from "./self-monitor.js";

async function bootstrap() {
	try {
		process.loadEnvFile("../../.env");
	} catch {
		// En producción las variables vienen del entorno.
	}
	// Falla rápido y con un mensaje claro si falta configuración.
	const env = validateWorkerEnv(process.env);
	startSelfMonitor({ dsn: env.SELF_MONITOR_DSN, environment: env.NODE_ENV });

	// Aplicación standalone: sin servidor HTTP, solo procesa colas.
	const app = await NestFactory.createApplicationContext(AppModule, {
		bufferLogs: true,
	});
	app.useLogger(app.get(Logger));
	app.enableShutdownHooks();
	app.get(Logger).log("Worker listo, escuchando la cola 'events'");
}

bootstrap();
