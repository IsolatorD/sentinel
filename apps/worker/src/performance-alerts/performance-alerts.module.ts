import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { PERFORMANCE_ALERTS_QUEUE } from "@sentinel/shared";
import { AlertsModule } from "../alerts/alerts.module.js";
import { AlertsRepository } from "../alerts/alerts.repository.js";
import { DrizzlePerformanceAlertsRepository } from "./drizzle-performance-alerts.repository.js";
import { PerformanceAlertsProcessor } from "./performance-alerts.processor.js";
import { PerformanceAlertsRepository } from "./performance-alerts.repository.js";
import { PerformanceAlertsScheduler } from "./performance-alerts.scheduler.js";
import { PerformanceAlertsService } from "./performance-alerts.service.js";

@Module({
	imports: [
		BullModule.registerQueue({ name: PERFORMANCE_ALERTS_QUEUE }),
		AlertsModule,
	],
	providers: [
		AlertsRepository,
		PerformanceAlertsProcessor,
		PerformanceAlertsScheduler,
		PerformanceAlertsService,
		{
			provide: PerformanceAlertsRepository,
			useClass: DrizzlePerformanceAlertsRepository,
		},
	],
})
export class PerformanceAlertsModule {}
