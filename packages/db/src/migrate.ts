import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

// Carpeta con las migraciones SQL generadas por drizzle-kit (packages/db/drizzle).
const DEFAULT_FOLDER = new URL("../drizzle", import.meta.url).pathname;

/** Aplica las migraciones pendientes. Idempotente: se puede ejecutar en cada despliegue. */
export async function runMigrations(
	connectionString: string,
	migrationsFolder: string = DEFAULT_FOLDER,
): Promise<void> {
	const pool = new Pool({ connectionString });
	try {
		await migrate(drizzle(pool), { migrationsFolder });
	} finally {
		await pool.end();
	}
}
