import { Injectable } from "@nestjs/common";
import { emailRecipientsSchema } from "@sentinel/shared";
import { AlertsRepository } from "../alerts.repository.js";
import { DeliveryError } from "../domain/delivery-error.js";
import { emailContent } from "../domain/messages.js";
import { MailerService } from "../mailer.service.js";
import { Notifier, type NotifyInput } from "./notifier.js";

@Injectable()
export class EmailNotifier extends Notifier {
	readonly type = "email";

	constructor(
		private readonly mailer: MailerService,
		private readonly repository: AlertsRepository,
	) {
		super();
	}

	async send({ channel, payload, organizationId }: NotifyInput) {
		const recipients = emailRecipientsSchema.safeParse(
			channel.config.recipients,
		);
		if (!recipients.success)
			throw new DeliveryError("The channel has no valid recipients", {
				permanent: true,
			});

		// Se resuelve al enviar: quien dejó la organización deja de recibir avisos.
		const emails = await this.repository.memberEmails(
			organizationId,
			recipients.data,
		);
		if (emails.length === 0)
			throw new DeliveryError(
				"None of the recipients belong to the organization anymore",
				{
					permanent: true,
				},
			);

		const { subject, text, html } = emailContent(payload);
		// Un correo por persona: nadie ve las direcciones de los demás.
		for (const to of emails)
			await this.mailer.send({ to, subject, text, html });
		return {};
	}
}
