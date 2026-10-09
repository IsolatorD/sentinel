import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createTransport, type Transporter } from "nodemailer";
import { DeliveryError } from "../alerts/domain/delivery-error.js";
import type { WorkerEnv } from "../config/env.js";

export interface Mail {
	to: string;
	subject: string;
	text: string;
	html: string;
}

/** Único punto de salida de correo: lee el SMTP del entorno y traduce sus errores a `DeliveryError`. */
@Injectable()
export class MailerService {
	private readonly logger = new Logger(MailerService.name);
	private transport?: Transporter;
	private readonly from: string;
	private readonly url?: string;

	constructor(config: ConfigService<WorkerEnv, true>) {
		this.url = config.get("SMTP_URL", { infer: true });
		this.from = config.get("SMTP_FROM", { infer: true });
	}

	get enabled(): boolean {
		return Boolean(this.url);
	}

	async send(mail: Mail): Promise<void> {
		if (!this.url) {
			throw new DeliveryError(
				"Email is not configured on this server (SMTP_URL)",
				{
					permanent: true,
				},
			);
		}
		this.transport ??= createTransport(this.url);
		try {
			await this.transport.sendMail({ from: this.from, ...mail });
		} catch (cause) {
			const error = cause as Error & { responseCode?: number };
			this.logger.warn(`SMTP: ${error.message}`);
			// 5xx del servidor SMTP (dirección rechazada, etc.): reintentar no sirve.
			const permanent = (error.responseCode ?? 0) >= 500;
			throw new DeliveryError(error.message, { permanent });
		}
	}
}
