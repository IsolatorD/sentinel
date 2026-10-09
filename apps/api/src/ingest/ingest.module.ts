import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EVENTS_QUEUE } from "@sentinel/shared";
import { IngestController } from "./ingest.controller.js";
import { IngestGuard } from "./ingest.guard.js";
import { IngestService } from "./ingest.service.js";
import { RateLimiterService } from "./rate-limiter.service.js";

@Module({
	imports: [
		BullModule.forRootAsync({
			inject: [ConfigService],
			useFactory: (config: ConfigService) => ({
				connection: {
					host: config.get<string>("REDIS_HOST", "localhost"),
					port: Number(config.get<string>("REDIS_PORT", "6379")),
				},
			}),
		}),
		BullModule.registerQueue({ name: EVENTS_QUEUE }),
	],
	controllers: [IngestController],
	providers: [IngestService, IngestGuard, RateLimiterService],
})
export class IngestModule {}
