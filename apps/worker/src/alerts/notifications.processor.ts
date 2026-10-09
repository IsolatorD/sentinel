import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import {
	NOTIFICATIONS_QUEUE,
	type NotificationJobData,
} from "@sentinel/shared";
import { type Job, UnrecoverableError } from "bullmq";
import { AlertsRepository } from "./alerts.repository.js";
import { DeliveryError } from "./domain/delivery-error.js";
import { EmailNotifier } from "./notifiers/email.notifier.js";
import type { Notifier } from "./notifiers/notifier.js";
import { SlackNotifier } from "./notifiers/slack.notifier.js";
import { WebhookNotifier } from "./notifiers/webhook.notifier.js";

@Processor(NOTIFICATIONS_QUEUE, { concurrency: 5 })
export class NotificationsProcessor extends WorkerHost {
	private readonly logger = new Logger(NotificationsProcessor.name);
	private readonly notifiers: Map<string, Notifier>;

	constructor(
		private readonly repository: AlertsRepository,
		email: EmailNotifier,
		webhook: WebhookNotifier,
		slack: SlackNotifier,
	) {
		super();
		this.notifiers = new Map([email, webhook, slack].map((n) => [n.type, n]));
	}

	async process(job: Job<NotificationJobData>): Promise<void> {
		const delivery = await this.repository.findDelivery(job.data.deliveryId);
		if (!delivery || delivery.status === "sent") return;

		const attempts = job.attemptsMade + 1;
		const maxAttempts = job.opts.attempts ?? 1;

		const fail = async (
			message: string,
			permanent: boolean,
			statusCode?: number,
		) => {
			const final = permanent || attempts >= maxAttempts;
			await this.repository.markFailure(
				delivery.id,
				attempts,
				message,
				final,
				statusCode,
			);
			this.logger.warn(
				`aviso ${delivery.id}: ${message}${final ? " (definitivo)" : ` (intento ${attempts}/${maxAttempts})`}`,
			);
			if (permanent) throw new UnrecoverableError(message);
			throw new DeliveryError(message, { permanent: false, statusCode });
		};

		const channel = delivery.channelId
			? await this.repository.findChannel(delivery.channelId)
			: undefined;
		if (!channel) return fail("The channel was deleted", true);
		if (!channel.enabled && delivery.kind === "alert")
			return fail("The channel is disabled", true);

		const notifier = this.notifiers.get(channel.type);
		if (!notifier)
			return fail(`Unsupported channel type: ${channel.type}`, true);

		try {
			const { statusCode } = await notifier.send({
				channel,
				payload: delivery.payload,
				deliveryId: delivery.id,
				organizationId: delivery.payload.organization.id,
			});
			await this.repository.markSent(delivery.id, attempts, statusCode);
			this.logger.log(`aviso ${delivery.id} enviado por ${channel.type}`);
		} catch (error) {
			if (error instanceof UnrecoverableError) throw error;
			if (error instanceof DeliveryError)
				return fail(error.message, error.permanent, error.statusCode);
			return fail((error as Error).message, false);
		}
	}
}
