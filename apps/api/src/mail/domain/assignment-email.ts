import { DEFAULT_LOCALE, type Locale, translate } from "@sentinel/shared";

export interface AssignmentEmailInput {
	assignerName: string;
	projectName: string;
	issueTitle: string;
	/** Enlace del panel al issue. */
	url: string;
	/** Idioma de quien recibe la asignación. */
	locale?: Locale;
}

const escapeHtml = (text: string) =>
	text
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;");

const clip = (text: string, max: number) =>
	text.length > max ? `${text.slice(0, max - 1)}…` : text;

/** Correo "te asignaron un issue", en el idioma de quien lo recibe. */
export function assignmentEmail(input: AssignmentEmailInput) {
	const locale = input.locale ?? DEFAULT_LOCALE;
	const vars = {
		assigner: clip(input.assignerName, 80),
		project: clip(input.projectName, 80),
	};
	const title = clip(input.issueTitle, 150);
	const subject = translate(locale, "EMAIL_ASSIGN_SUBJECT", vars);
	const body = translate(locale, "EMAIL_ASSIGN_BODY", vars);
	const view = translate(locale, "EMAIL_ASSIGN_VIEW");
	const hint = translate(locale, "EMAIL_ASSIGN_HINT");

	const text = [body, "", title, "", `${view}: ${input.url}`, "", hint].join(
		"\n",
	);
	// Quien asigna, el proyecto y el título los controlan los usuarios: se escapan en el HTML.
	const html = `<div style="font-family:system-ui,sans-serif;max-width:560px;color:#2b2233">
<h2 style="margin:0 0 12px;font-size:18px;line-height:1.3">${escapeHtml(translate(locale, "EMAIL_ASSIGN_TITLE"))}</h2>
<p style="margin:0 0 8px;font-size:14px">${escapeHtml(body)}</p>
<p style="margin:0 0 20px;font-size:15px;font-weight:600">${escapeHtml(title)}</p>
<p><a href="${escapeHtml(input.url)}" style="display:inline-block;background:#6c5fc7;color:#fff;text-decoration:none;padding:9px 16px;border-radius:6px;font-size:14px">${escapeHtml(view)}</a></p>
<p style="font-size:12px;color:#8b8199">${escapeHtml(hint)}</p>
</div>`;
	return { subject, text, html };
}
