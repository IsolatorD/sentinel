// Configuración de las pruebas de integración. Todo se puede cambiar por variables
// de entorno; los valores por defecto coinciden con `docker-compose.yml`.
export const e2eConfig = {
	/** Conexión administrativa a Postgres (para crear y borrar la base de pruebas). */
	postgresAdminUrl:
		process.env.E2E_POSTGRES_URL ??
		"postgresql://sentinel:sentinel@localhost:5432/postgres",
	/** Base propia de las pruebas: nunca toca los datos de desarrollo. */
	databaseName: "sentinel_e2e",
	redisHost: process.env.E2E_REDIS_HOST ?? "localhost",
	redisPort: Number(process.env.E2E_REDIS_PORT ?? 6379),
	/** Índice de Redis propio, para no mezclarse con la cola de desarrollo (índice 0). */
	redisDb: Number(process.env.E2E_REDIS_DB ?? 15),
	/** Eventos por minuto permitidos por proyecto en el servidor de pruebas. */
	ingestRateLimitPerMinute: 40,
};

export function databaseUrl(adminUrl: string, name: string): string {
	const url = new URL(adminUrl);
	url.pathname = `/${name}`;
	return url.toString();
}
