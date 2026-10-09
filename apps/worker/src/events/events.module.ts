import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { EVENTS_QUEUE, EventsProcessor } from "./events.processor.js";

@Module({
	imports: [BullModule.registerQueue({ name: EVENTS_QUEUE })],
	providers: [EventsProcessor],
})
export class EventsModule {}
