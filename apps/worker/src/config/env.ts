import {
	baseEnvShape,
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
});

export type WorkerEnv = z.infer<typeof workerEnvSchema>;

export function validateWorkerEnv(raw: Record<string, unknown>): WorkerEnv {
	return parseEnv(workerEnvSchema, raw);
}
