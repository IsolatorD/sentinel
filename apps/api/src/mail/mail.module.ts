import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { EMAILS_QUEUE } from "@sentinel/shared";
import { MailQueueService } from "./mail-queue.service.js";

@Module({
	imports: [BullModule.registerQueue({ name: EMAILS_QUEUE })],
	providers: [MailQueueService],
	exports: [MailQueueService],
})
export class MailModule {}
