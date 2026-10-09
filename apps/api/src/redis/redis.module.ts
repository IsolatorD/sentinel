import { Global, Inject, Module, type OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Redis } from "ioredis";
import type { ApiEnv } from "../config/env.js";

export const REDIS = Symbol("REDIS");

@Global()
@Module({
	providers: [
		{
			provide: REDIS,
			inject: [ConfigService],
			useFactory: (config: ConfigService<ApiEnv, true>) =>
				new Redis({
					host: config.get("REDIS_HOST", { infer: true }),
					port: config.get("REDIS_PORT", { infer: true }),
					db: config.get("REDIS_DB", { infer: true }),
				}),
		},
	],
	exports: [REDIS],
})
export class RedisModule implements OnModuleDestroy {
	constructor(@Inject(REDIS) private readonly redis: Redis) {}

	async onModuleDestroy() {
		await this.redis.quit();
	}
}
