import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { NOTIFICATIONS_QUEUE } from "@sentinel/shared";
import { MailModule } from "../mail/mail.module.js";
import { AlertsRepository } from "./alerts.repository.js";
import { AlertsService } from "./alerts.service.js";
import { NotificationsProcessor } from "./notifications.processor.js";
import { EmailNotifier } from "./notifiers/email.notifier.js";
import { SlackNotifier } from "./notifiers/slack.notifier.js";
import { WebhookNotifier } from "./notifiers/webhook.notifier.js";
import { redisProvider } from "./redis.provider.js";

@Module({
	imports: [
		BullModule.registerQueue({ name: NOTIFICATIONS_QUEUE }),
		MailModule,
	],
	providers: [
		redisProvider,
		AlertsRepository,
		AlertsService,
		EmailNotifier,
		WebhookNotifier,
		SlackNotifier,
		NotificationsProcessor,
	],
	exports: [AlertsService],
})
export class AlertsModule {}
