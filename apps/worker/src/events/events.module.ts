import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { EVENTS_QUEUE } from "@sentinel/shared";
import { AlertsModule } from "../alerts/alerts.module.js";
import { DrizzleEventRepository } from "./drizzle-event.repository.js";
import { DrizzleSourceMapRepository } from "./drizzle-source-map.repository.js";
import { EventRepository } from "./event.repository.js";
import { EventsProcessor } from "./events.processor.js";
import { EventsService } from "./events.service.js";
import { SourceMapRepository } from "./source-map.repository.js";
import { SymbolicatorService } from "./symbolicator.service.js";

@Module({
	imports: [BullModule.registerQueue({ name: EVENTS_QUEUE }), AlertsModule],
	providers: [
		EventsProcessor,
		EventsService,
		SymbolicatorService,
		{ provide: SourceMapRepository, useClass: DrizzleSourceMapRepository },
		{ provide: EventRepository, useClass: DrizzleEventRepository },
	],
})
export class EventsModule {}
