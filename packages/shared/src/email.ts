export const EMAILS_QUEUE = "emails";

/** Un correo genérico: la API lo encola y el worker (único con acceso al SMTP) lo envía. */
export interface EmailJobData {
	to: string;
	subject: string;
	text: string;
	html: string;
}
