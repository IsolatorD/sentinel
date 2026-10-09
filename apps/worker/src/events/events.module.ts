import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { EVENTS_QUEUE } from "@sentinel/shared";
import { EventsProcessor } from "./events.processor.js";
import { EventsService } from "./events.service.js";

@Module({
	imports: [BullModule.registerQueue({ name: EVENTS_QUEUE })],
	providers: [EventsProcessor, EventsService],
})
export class EventsModule {}
