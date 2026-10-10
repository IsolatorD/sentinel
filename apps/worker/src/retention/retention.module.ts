import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { MAINTENANCE_QUEUE } from "@sentinel/shared";
import { DrizzleRetentionRepository } from "./drizzle-retention.repository.js";
import { RetentionProcessor } from "./retention.processor.js";
import { RetentionRepository } from "./retention.repository.js";
import { RetentionScheduler } from "./retention.scheduler.js";
import { RetentionService } from "./retention.service.js";

@Module({
	imports: [BullModule.registerQueue({ name: MAINTENANCE_QUEUE })],
	providers: [
		RetentionProcessor,
		RetentionScheduler,
		RetentionService,
		{ provide: RetentionRepository, useClass: DrizzleRetentionRepository },
	],
})
export class RetentionModule {}
