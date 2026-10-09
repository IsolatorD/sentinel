import { Injectable } from "@nestjs/common";
import { emailRecipientsSchema } from "@sentinel/shared";
import { MailerService } from "../../mail/mailer.service.js";
import { AlertsRepository } from "../alerts.repository.js";
import { DeliveryError } from "../domain/delivery-error.js";
import { emailContent } from "../domain/messages.js";
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
		const people = await this.repository.memberRecipients(
			organizationId,
			recipients.data,
		);
		if (people.length === 0)
			throw new DeliveryError(
				"None of the recipients belong to the organization anymore",
				{
					permanent: true,
				},
			);

		// Un correo por persona (nadie ve las direcciones de los demás), en el idioma de cada una.
		for (const { email, locale } of people) {
			await this.mailer.send({ to: email, ...emailContent(payload, locale) });
		}
		return {};
	}
}
