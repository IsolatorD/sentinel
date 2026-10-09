import { Global, Inject, Module, type OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Redis } from "ioredis";

export const REDIS = Symbol("REDIS");

@Global()
@Module({
	providers: [
		{
			provide: REDIS,
			inject: [ConfigService],
			useFactory: (config: ConfigService) =>
				new Redis({
					host: config.get<string>("REDIS_HOST", "localhost"),
					port: Number(config.get<string>("REDIS_PORT", "6379")),
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
