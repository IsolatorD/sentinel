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
	/** Índice de la base de Redis (0 a 15). Permite aislar entornos que comparten un Redis. */
	REDIS_DB: z.coerce.number().int().min(0).max(15).default(0),
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

/** SMTP para enviar correos (alertas, invitaciones). Sin `SMTP_URL`, el envío de correo queda desactivado. */
export const smtpEnvShape = {
	/** p. ej. smtp://usuario:clave@smtp.ejemplo.com:587 (smtps:// para TLS implícito). */
	SMTP_URL: emptyToUndefined(z.string().url().optional()),
	/** Remitente: `Sentinel <alertas@ejemplo.com>`. */
	SMTP_FROM: emptyToUndefined(
		z.string().min(3).default("Sentinel <noreply@sentinel.local>"),
	),
};

/** Destinos permitidos para los webhooks. La API valida al crear el canal y el worker al enviar. */
export const webhookEnvShape = {
	/**
	 * Permite que los webhooks apunten a direcciones privadas o de loopback. Solo para desarrollo y
	 * pruebas: en producción un webhook que llegue a la red interna es una vulnerabilidad (SSRF).
	 */
	ALLOW_PRIVATE_WEBHOOKS: emptyToUndefined(
		z
			.enum(["true", "false"])
			.transform((v) => v === "true")
			.default(false),
	),
};
