import { runMigrations } from "./migrate.js";

// Aplica las migraciones pendientes y termina. Es lo que ejecuta el despliegue antes de arrancar la API
// y el worker (ver docker-compose.prod.yml); es idempotente, así que se puede repetir en cada actualización.
const url = process.env.DATABASE_URL;
if (!url) {
	console.error("DATABASE_URL is not set");
	process.exit(1);
}

try {
	await runMigrations(url);
	console.log("migrations applied");
} catch (error) {
	console.error("migration failed:", error);
	process.exit(1);
}
