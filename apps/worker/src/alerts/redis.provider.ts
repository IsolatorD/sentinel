import { ConfigService } from "@nestjs/config";
import { Redis } from "ioredis";
import type { WorkerEnv } from "../config/env.js";

export const ALERTS_REDIS = Symbol("ALERTS_REDIS");

/** Conexión propia a Redis para los períodos de espera de las alertas (`SET NX EX`). */
export const redisProvider = {
	provide: ALERTS_REDIS,
	inject: [ConfigService],
	useFactory: (config: ConfigService<WorkerEnv, true>) =>
		new Redis({
			host: config.get("REDIS_HOST", { infer: true }),
			port: config.get("REDIS_PORT", { infer: true }),
			db: config.get("REDIS_DB", { infer: true }),
		}),
};
