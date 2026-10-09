import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { EMAILS_QUEUE } from "@sentinel/shared";
import { EmailsProcessor } from "./emails.processor.js";
import { MailerService } from "./mailer.service.js";

@Module({
	imports: [BullModule.registerQueue({ name: EMAILS_QUEUE })],
	providers: [MailerService, EmailsProcessor],
	exports: [MailerService],
})
export class MailModule {}
