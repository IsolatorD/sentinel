import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EVENTS_QUEUE, TRANSACTIONS_QUEUE } from "@sentinel/shared";
import type { ApiEnv } from "../config/env.js";
import { ProjectsModule } from "../projects/projects.module.js";
import { IngestController } from "./ingest.controller.js";
import { IngestGuard } from "./ingest.guard.js";
import { IngestService } from "./ingest.service.js";
import { RateLimiterService } from "./rate-limiter.service.js";
import { TransactionsController } from "./transactions.controller.js";
import { TransactionsService } from "./transactions.service.js";

@Module({
	imports: [
		ProjectsModule,
		BullModule.forRootAsync({
			inject: [ConfigService],
			useFactory: (config: ConfigService<ApiEnv, true>) => ({
				connection: {
					host: config.get("REDIS_HOST", { infer: true }),
					port: config.get("REDIS_PORT", { infer: true }),
					db: config.get("REDIS_DB", { infer: true }),
				},
			}),
		}),
		BullModule.registerQueue(
			{ name: EVENTS_QUEUE },
			{ name: TRANSACTIONS_QUEUE },
		),
	],
	controllers: [IngestController, TransactionsController],
	providers: [
		IngestService,
		TransactionsService,
		IngestGuard,
		RateLimiterService,
	],
})
export class IngestModule {}
