import { z } from "zod";

/** Trata "" como ausente (los .env suelen dejar variables vacías). */
export const emptyToUndefined = <T extends z.ZodType>(schema: T) =>
	z.preprocess((value) => (value === "" ? undefined : value), schema);

export const LOG_LEVELS = [
	"fatal",
	"error",
	"warn",
	"info",
	"debug",
	"trace",
	"silent",
] as const;

/** Variables comunes a todos los procesos de backend. */
export const baseEnvShape = {
	NODE_ENV: z
		.enum(["development", "test", "production"])
		.default("development"),
	LOG_LEVEL: z.enum(LOG_LEVELS).default("info"),
	DATABASE_URL: z.string().url(),
	REDIS_HOST: z.string().min(1).default("localhost"),
	REDIS_PORT: z.coerce.number().int().positive().default(6379),
};

/** Valida las variables de entorno y falla al arrancar con un mensaje claro. */
export function parseEnv<S extends z.ZodType>(
	schema: S,
	raw: Record<string, unknown>,
): z.infer<S> {
	const result = schema.safeParse(raw);
	if (!result.success) {
		const lines = result.error.issues.map(
			(i) => `  - ${i.path.join(".") || "(env)"}: ${i.message}`,
		);
		throw new Error(
			`Invalid environment configuration:\n${lines.join("\n")}\nCheck your .env (see .env.example).`,
		);
	}
	return result.data;
}
