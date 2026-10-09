import { DEFAULT_LOCALE, type Locale, translate } from "@sentinel/shared";

export interface VerificationEmailInput {
	name: string;
	/** Enlace que verifica la cuenta. */
	url: string;
	locale?: Locale;
}

const escapeHtml = (text: string) =>
	text
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;");

/** Correo para confirmar la dirección de una cuenta nueva, en el idioma de quien se registra. */
export function verificationEmail(input: VerificationEmailInput) {
	const locale = input.locale ?? DEFAULT_LOCALE;
	const name = input.name.trim().slice(0, 80) || "👋";
	const subject = translate(locale, "EMAIL_VERIFY_SUBJECT");
	const body = translate(locale, "EMAIL_VERIFY_BODY", { name });
	const action = translate(locale, "EMAIL_VERIFY_ACTION");
	const hint = translate(locale, "EMAIL_VERIFY_HINT");

	const text = [body, "", `${action}: ${input.url}`, "", hint].join("\n");
	const html = `<div style="font-family:system-ui,sans-serif;max-width:560px;color:#2b2233">
<h2 style="margin:0 0 12px;font-size:18px;line-height:1.3">${escapeHtml(translate(locale, "EMAIL_VERIFY_TITLE"))}</h2>
<p style="margin:0 0 20px;font-size:14px">${escapeHtml(body)}</p>
<p><a href="${escapeHtml(input.url)}" style="display:inline-block;background:#6c5fc7;color:#fff;text-decoration:none;padding:9px 16px;border-radius:6px;font-size:14px">${escapeHtml(action)}</a></p>
<p style="font-size:12px;color:#8b8199">${escapeHtml(hint)}</p>
</div>`;
	return { subject, text, html };
}
