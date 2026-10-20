import {
	baseEnvShape,
	emptyToUndefined,
	parseEnv,
	smtpEnvShape,
	webhookEnvShape,
} from "@sentinel/shared";
import { z } from "zod";

const workerEnvSchema = z.object({
	...baseEnvShape,
	...smtpEnvShape,
	...webhookEnvShape,
	/** Origen del panel: se usa para los enlaces a los issues en los avisos. */
	WEB_ORIGIN: z.string().url().default("http://localhost:5173"),
	/** Espera base entre reintentos de un aviso fallido (crece al doble en cada intento). */
	NOTIFICATION_RETRY_DELAY_MS: z.coerce.number().int().min(0).default(10_000),
	/** Borra cada día los eventos y transacciones más antiguos que la retención de su proyecto. */
	/** DSN de un proyecto de esta misma instancia al que el worker reporta sus errores. Sin valor, nada. */
	SELF_MONITOR_DSN: emptyToUndefined(z.string().url().optional()),
	RETENTION_ENABLED: z
		.enum(["true", "false"])
		.default("true")
		.transform((v) => v === "true"),
	/** Cuándo corre la retención (cron de 5 campos, hora del servidor). Por defecto, a las 03:00. */
	RETENTION_CRON: z.string().min(1).default("0 3 * * *"),
	/** Evalúa las reglas de alerta de rendimiento (p95 y tasa de errores) de todos los proyectos. */
	PERFORMANCE_ALERTS_ENABLED: z
		.enum(["true", "false"])
		.default("true")
		.transform((v) => v === "true"),
	/** Cada cuánto se evalúan (cron de 5 campos). Por defecto, cada minuto. */
	PERFORMANCE_ALERTS_CRON: z.string().min(1).default("* * * * *"),
});

export type WorkerEnv = z.infer<typeof workerEnvSchema>;

export function validateWorkerEnv(raw: Record<string, unknown>): WorkerEnv {
	return parseEnv(workerEnvSchema, raw);
}
