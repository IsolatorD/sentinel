import { randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { runMigrations } from "@sentinel/db";
import { Redis } from "ioredis";
import pg from "pg";
import type { TestProject } from "vitest/node";
import { databaseUrl, e2eConfig } from "./support/config.js";
import type { E2EContext } from "./support/context.js";
import {
	freePort,
	logDir,
	type ManagedProcess,
	startApp,
	stop,
	waitFor,
} from "./support/processes.js";
import { startSmtpSink } from "./support/smtp-sink.js";

const processes: ManagedProcess[] = [];
let stopSmtp: (() => Promise<void>) | undefined;

async function recreateDatabase(adminUrl: string, name: string) {
	const admin = new pg.Client({ connectionString: adminUrl });
	await admin.connect();
	try {
		await admin.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
		await admin.query(`CREATE DATABASE ${name}`);
	} finally {
		await admin.end();
	}
}

export default async function setup(project: TestProject) {
	const cfg = e2eConfig;
	const dbUrl = databaseUrl(cfg.postgresAdminUrl, cfg.databaseName);

	// 1. Base de datos propia, siempre limpia, con el esquema real (migraciones).
	await recreateDatabase(cfg.postgresAdminUrl, cfg.databaseName);
	await runMigrations(dbUrl);

	// 2. Índice de Redis propio, vacío.
	const redis = new Redis({
		host: cfg.redisHost,
		port: cfg.redisPort,
		db: cfg.redisDb,
	});
	await redis.flushdb();
	await redis.quit();

	// 3. Servidor SMTP de captura (los correos de alertas se leen del archivo).
	const smtpPort = await freePort();
	const mailFile = join(logDir, "mail.jsonl");
	mkdirSync(logDir, { recursive: true });
	stopSmtp = await startSmtpSink(smtpPort, mailFile);

	// 4. API y worker compilados, como en producción.
	const port = await freePort();
	const baseUrl = `http://localhost:${port}`;
	const shared = {
		NODE_ENV: "test",
		LOG_LEVEL: "warn",
		DATABASE_URL: dbUrl,
		REDIS_HOST: cfg.redisHost,
		REDIS_PORT: String(cfg.redisPort),
		REDIS_DB: String(cfg.redisDb),
		// Los webhooks de las pruebas apuntan a servidores locales.
		ALLOW_PRIVATE_WEBHOOKS: "true",
		SMTP_URL: `smtp://127.0.0.1:${smtpPort}`,
		SMTP_FROM: "Sentinel <alerts@sentinel.test>",
	};
	const secret = randomBytes(24).toString("base64");
	const apiEnv = {
		...shared,
		BETTER_AUTH_SECRET: secret,
		WEB_ORIGIN: "http://localhost:5173",
		INGEST_RATE_LIMIT_PER_MINUTE: String(cfg.ingestRateLimitPerMinute),
		ENABLE_DOCS: "true",
	};
	// La API principal no exige verificar el correo (así cada prueba se registra en un paso); la segunda sí.
	const api = startApp("api", {
		...apiEnv,
		API_PORT: String(port),
		BETTER_AUTH_URL: baseUrl,
		REQUIRE_EMAIL_VERIFICATION: "false",
	});
	const verifyPort = await freePort();
	const verifyBaseUrl = `http://localhost:${verifyPort}`;
	const verifyApi = startApp(
		"api",
		{
			...apiEnv,
			API_PORT: String(verifyPort),
			BETTER_AUTH_URL: verifyBaseUrl,
			REQUIRE_EMAIL_VERIFICATION: "true",
		},
		"api-verify",
	);
	const worker = startApp("worker", {
		...shared,
		WEB_ORIGIN: "http://localhost:5173",
		NOTIFICATION_RETRY_DELAY_MS: "150",
		// Las pruebas de rendimiento lanzan la evaluación a mano: así no se cruza con una repetición programada.
		PERFORMANCE_ALERTS_ENABLED: "false",
	});
	processes.push(api, verifyApi, worker);

	await waitFor(async () => (await fetch(`${baseUrl}/api/health`)).ok, {
		timeoutMs: 60_000,
		label: "la API responde en /api/health",
		processes,
	});

	await waitFor(async () => (await fetch(`${verifyBaseUrl}/api/health`)).ok, {
		timeoutMs: 60_000,
		label: "la API con verificación responde en /api/health",
		processes,
	});

	const context: E2EContext = {
		baseUrl,
		verifyBaseUrl,
		databaseUrl: dbUrl,
		redis: { host: cfg.redisHost, port: cfg.redisPort, db: cfg.redisDb },
		ingestRateLimitPerMinute: cfg.ingestRateLimitPerMinute,
		mailFile,
	};
	project.provide("e2e", context);

	return async function teardown() {
		await Promise.all(processes.map(stop));
		await stopSmtp?.();
		const cleanup = new Redis({
			host: cfg.redisHost,
			port: cfg.redisPort,
			db: cfg.redisDb,
		});
		await cleanup.flushdb();
		await cleanup.quit();
		const admin = new pg.Client({ connectionString: cfg.postgresAdminUrl });
		await admin.connect();
		await admin.query(
			`DROP DATABASE IF EXISTS ${cfg.databaseName} WITH (FORCE)`,
		);
		await admin.end();
	};
}
