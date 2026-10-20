import {
	baseEnvShape,
	emptyToUndefined,
	parseEnv,
	RETENTION_OPTIONS,
	smtpEnvShape,
	webhookEnvShape,
} from "@sentinel/shared";
import { z } from "zod";

const booleanString = z.enum(["true", "false"]).transform((v) => v === "true");

const apiEnvSchema = z
	.object({
		...baseEnvShape,
		...smtpEnvShape,
		...webhookEnvShape,
		API_PORT: z.coerce.number().int().positive().default(3000),
		WEB_ORIGIN: z.string().url().default("http://localhost:5173"),
		BETTER_AUTH_SECRET: z.string().min(16, "must be at least 16 characters"),
		BETTER_AUTH_URL: emptyToUndefined(z.string().url().optional()),
		PUBLIC_API_URL: emptyToUndefined(z.string().url().optional()),
		GOOGLE_CLIENT_ID: emptyToUndefined(z.string().optional()),
		GOOGLE_CLIENT_SECRET: emptyToUndefined(z.string().optional()),
		INGEST_RATE_LIMIT_PER_MINUTE: z.coerce
			.number()
			.int()
			.positive()
			.default(600),
		/** Exige verificar el correo para entrar (solo tiene efecto si hay SMTP: sin correo nadie podría verificar). */
		REQUIRE_EMAIL_VERIFICATION: emptyToUndefined(booleanString.default(true)),
		TRUST_PROXY: emptyToUndefined(booleanString.default(false)),
		ENABLE_DOCS: emptyToUndefined(booleanString.optional()),
		/**
		 * DSN de un proyecto de esta misma instancia al que la propia instancia reporta sus errores
		 * (API, worker y web). Sin valor, no se reporta nada.
		 */
		SELF_MONITOR_DSN: emptyToUndefined(z.string().url().optional()),
		/**
		 * Lo mismo para la web de la instancia, con su propio proyecto. Si falta, la web usa `SELF_MONITOR_DSN`.
		 * (La DSN de un navegador es pública: se entrega a quien abre la web.)
		 */
		SELF_MONITOR_WEB_DSN: emptyToUndefined(z.string().url().optional()),
		/** `false` cierra el registro (email y Google): solo entra quien ya tiene cuenta. */
		SIGNUP_ENABLED: emptyToUndefined(booleanString.default(true)),
		/** Límites con los que nacen los proyectos nuevos (los existentes no cambian). Sin valor, no hay límite. */
		DEFAULT_MONTHLY_EVENT_QUOTA: emptyToUndefined(
			z.coerce.number().int().positive().optional(),
		),
		DEFAULT_MONTHLY_TRANSACTION_QUOTA: emptyToUndefined(
			z.coerce.number().int().positive().optional(),
		),
		/** Retención con la que nacen los proyectos nuevos; sin valor, la de la base de datos (90 días). */
		DEFAULT_RETENTION_DAYS: emptyToUndefined(
			z.coerce
				.number()
				.int()
				.refine(
					(v) => (RETENTION_OPTIONS as readonly number[]).includes(v),
					`must be one of ${RETENTION_OPTIONS.join(", ")}`,
				)
				.optional(),
		),
	})
	.refine(
		(e) => Boolean(e.GOOGLE_CLIENT_ID) === Boolean(e.GOOGLE_CLIENT_SECRET),
		{
			path: ["GOOGLE_CLIENT_ID"],
			message: "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set together",
		},
	)
	.transform((env) => {
		const baseUrl = env.BETTER_AUTH_URL ?? `http://localhost:${env.API_PORT}`;
		return {
			...env,
			BETTER_AUTH_URL: baseUrl,
			PUBLIC_API_URL: env.PUBLIC_API_URL ?? baseUrl,
			// La documentación se publica por defecto salvo en producción.
			ENABLE_DOCS: env.ENABLE_DOCS ?? env.NODE_ENV !== "production",
		};
	});

export type ApiEnv = z.infer<typeof apiEnvSchema>;

export function validateApiEnv(raw: Record<string, unknown>): ApiEnv {
	return parseEnv(apiEnvSchema, raw);
}
