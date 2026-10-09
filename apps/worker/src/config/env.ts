import { baseEnvShape, parseEnv } from "@sentinel/shared";
import { z } from "zod";

const workerEnvSchema = z.object({ ...baseEnvShape });

export type WorkerEnv = z.infer<typeof workerEnvSchema>;

export function validateWorkerEnv(raw: Record<string, unknown>): WorkerEnv {
	return parseEnv(workerEnvSchema, raw);
}
