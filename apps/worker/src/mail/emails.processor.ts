import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { EMAILS_QUEUE, type EmailJobData } from "@sentinel/shared";
import { type Job, UnrecoverableError } from "bullmq";
import { DeliveryError } from "../alerts/domain/delivery-error.js";
import { MailerService } from "./mailer.service.js";

/** Envía los correos que encola la API (invitaciones, etc.). Los reintentos los define quien encola. */
@Processor(EMAILS_QUEUE, { concurrency: 3 })
export class EmailsProcessor extends WorkerHost {
	private readonly logger = new Logger(EmailsProcessor.name);

	constructor(private readonly mailer: MailerService) {
		super();
	}

	async process(job: Job<EmailJobData>): Promise<void> {
		try {
			await this.mailer.send(job.data);
			this.logger.log(`correo "${job.data.subject}" enviado`);
		} catch (error) {
			// Un fallo permanente (dirección rechazada, SMTP sin configurar) no se arregla reintentando.
			if (error instanceof DeliveryError && error.permanent)
				throw new UnrecoverableError(error.message);
			throw error;
		}
	}
}
