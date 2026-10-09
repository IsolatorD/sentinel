import { defineConfig } from "drizzle-kit";

try {
	process.loadEnvFile("../../.env");
} catch {
	// En CI/producción las variables vienen del entorno.
}

export default defineConfig({
	dialect: "postgresql",
	schema: "./src/schema/index.ts",
	out: "./drizzle",
	dbCredentials: { url: process.env.DATABASE_URL ?? "" },
});
