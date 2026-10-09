import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EMAILS_QUEUE, type EmailJobData } from "@sentinel/shared";
import type { Queue } from "bullmq";
import type { ApiEnv } from "../config/env.js";

/** La API no habla con el SMTP: deja el correo en una cola y el worker lo envía (con reintentos). */
@Injectable()
export class MailQueueService {
	private readonly logger = new Logger(MailQueueService.name);
	private readonly enabled: boolean;

	constructor(
		@InjectQueue(EMAILS_QUEUE) private readonly queue: Queue<EmailJobData>,
		config: ConfigService<ApiEnv, true>,
	) {
		this.enabled = Boolean(config.get("SMTP_URL", { infer: true }));
	}

	async send(mail: EmailJobData): Promise<void> {
		if (!this.enabled) {
			this.logger.warn(
				`correo "${mail.subject}" no enviado: SMTP_URL no está configurado`,
			);
			return;
		}
		await this.queue.add("send", mail, {
			attempts: 5,
			backoff: { type: "exponential", delay: 10_000 },
			removeOnComplete: { age: 3_600 },
			removeOnFail: { age: 7 * 24 * 3_600 },
		});
	}
}
