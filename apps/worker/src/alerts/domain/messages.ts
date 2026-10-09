import { createHmac } from "node:crypto";
import {
	ALERT_TRIGGER_EVENT,
	type AlertPayload,
	DEFAULT_LOCALE,
	type Locale,
	type MessageCode,
	translate,
} from "@sentinel/shared";

const escapeHtml = (text: string) =>
	text
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;");

const clip = (text: string, max: number) =>
	text.length > max ? `${text.slice(0, max - 1)}…` : text;

/** Frase corta que explica por qué llegó el aviso. */
export function headline(
	payload: AlertPayload,
	locale: Locale = DEFAULT_LOCALE,
): string {
	if (payload.kind === "test") return translate(locale, "EMAIL_ALERT_TEST");
	const { issue, frequency } = payload;
	switch (payload.trigger) {
		case "new_issue":
			return translate(locale, "EMAIL_ALERT_NEW_ISSUE");
		case "regression":
			return issue.regressedInRelease
				? translate(locale, "EMAIL_ALERT_REGRESSION_IN", {
						release: issue.regressedInRelease,
					})
				: translate(locale, "EMAIL_ALERT_REGRESSION");
		case "frequency":
			return frequency
				? translate(locale, "EMAIL_ALERT_FREQUENCY", {
						count: frequency.count,
						window: formatWindow(frequency.windowMinutes, locale),
					})
				: translate(locale, "EMAIL_ALERT_FREQUENCY_GENERIC");
	}
}

function unit(
	locale: Locale,
	name: "MINUTE" | "HOUR" | "DAY",
	count: number,
): string {
	const code =
		`EMAIL_UNIT_${name}_${count === 1 ? "ONE" : "OTHER"}` as MessageCode;
	return translate(locale, code, { count });
}

function formatWindow(minutes: number, locale: Locale): string {
	if (minutes % 1440 === 0) return unit(locale, "DAY", minutes / 1440);
	if (minutes % 60 === 0) return unit(locale, "HOUR", minutes / 60);
	return unit(locale, "MINUTE", minutes);
}

/** Líneas "Etiqueta: valor" con lo más útil del issue. */
function details(
	payload: AlertPayload,
	locale: Locale,
): Array<[string, string]> {
	const { issue } = payload;
	const label = (code: MessageCode) => translate(locale, code);
	const level = `LEVEL_${issue.level.toUpperCase()}` as MessageCode;
	const rows: Array<[string, string]> = [
		[label("EMAIL_LABEL_PROJECT"), payload.project.name],
		[
			label("EMAIL_LABEL_LEVEL"),
			level in MESSAGES_LEVELS ? label(level) : issue.level,
		],
	];
	if (issue.culprit) rows.push([label("EMAIL_LABEL_WHERE"), issue.culprit]);
	if (issue.environment)
		rows.push([label("EMAIL_LABEL_ENVIRONMENT"), issue.environment]);
	if (issue.release) rows.push([label("EMAIL_LABEL_RELEASE"), issue.release]);
	rows.push([label("EMAIL_LABEL_EVENTS"), String(issue.eventCount)]);
	rows.push([label("EMAIL_LABEL_RULE"), payload.ruleName]);
	return rows;
}

const MESSAGES_LEVELS: Record<string, true> = {
	LEVEL_FATAL: true,
	LEVEL_ERROR: true,
	LEVEL_WARNING: true,
	LEVEL_INFO: true,
	LEVEL_DEBUG: true,
};

export function emailContent(
	payload: AlertPayload,
	locale: Locale = DEFAULT_LOCALE,
): {
	subject: string;
	text: string;
	html: string;
} {
	const title = clip(payload.issue.title, 150);
	const head = headline(payload, locale);
	const subject = `[${payload.project.name}] ${head}: ${title}`;
	const rows = details(payload, locale);
	const view = translate(locale, "EMAIL_ALERT_VIEW");
	const footer = translate(locale, "EMAIL_ALERT_FOOTER", {
		rule: payload.ruleName,
		organization: payload.organization.name,
	});
	const text = [
		head,
		"",
		title,
		"",
		...rows.map(([k, v]) => `${k}: ${v}`),
		"",
		`${view}: ${payload.url}`,
		"",
		footer,
	].join("\n");
	const html = `<div style="font-family:system-ui,sans-serif;max-width:560px;color:#2b2233">
<p style="margin:0 0 4px;font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:#6b6078">${escapeHtml(head)}</p>
<h2 style="margin:0 0 16px;font-size:18px;line-height:1.3">${escapeHtml(title)}</h2>
<table style="border-collapse:collapse;font-size:14px;margin-bottom:20px">
${rows.map(([k, v]) => `<tr><td style="padding:3px 16px 3px 0;color:#6b6078">${escapeHtml(k)}</td><td style="padding:3px 0">${escapeHtml(v)}</td></tr>`).join("\n")}
</table>
<p><a href="${escapeHtml(payload.url)}" style="display:inline-block;background:#6c5fc7;color:#fff;text-decoration:none;padding:9px 16px;border-radius:6px;font-size:14px">${escapeHtml(view)}</a></p>
<p style="font-size:12px;color:#8b8199">${escapeHtml(footer)}</p>
</div>`;
	return { subject, text, html };
}

/** Mensaje para un webhook entrante de Slack (también lo aceptan Discord y Teams en modo Slack). */
export function slackBody(payload: AlertPayload) {
	const title = clip(payload.issue.title, 150);
	const fields = details(payload, DEFAULT_LOCALE)
		.filter(([k]) => k !== "Project" && k !== "Rule")
		.map(([k, v]) => `*${k}:* ${clip(v, 200)}`)
		.join("\n");
	return {
		text: `${headline(payload)}: ${title} (${payload.project.name})`,
		blocks: [
			{
				type: "header",
				text: { type: "plain_text", text: clip(headline(payload), 150) },
			},
			{
				type: "section",
				text: {
					type: "mrkdwn",
					text: `*<${payload.url}|${escapeSlack(title)}>*\n${fields}`,
				},
			},
			{
				type: "context",
				elements: [
					{
						type: "mrkdwn",
						text: `${escapeSlack(payload.project.name)} · rule “${escapeSlack(payload.ruleName)}”`,
					},
				],
			},
		],
	};
}

const escapeSlack = (text: string) =>
	text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

/** Cuerpo del webhook genérico: estable y documentado; los cambios futuros solo añaden campos. */
export function webhookBody(
	payload: AlertPayload,
	deliveryId: string,
	now: Date,
) {
	return {
		event:
			payload.kind === "test"
				? "alert.test"
				: ALERT_TRIGGER_EVENT[payload.trigger],
		delivery_id: deliveryId,
		timestamp: now.toISOString(),
		rule: { name: payload.ruleName, trigger: payload.trigger },
		organization: payload.organization,
		project: payload.project,
		issue: payload.issue,
		...(payload.frequency && { frequency: payload.frequency }),
		url: payload.url,
	};
}

/**
 * Firma HMAC-SHA256 de `<timestamp>.<cuerpo>`. Incluir el momento permite al receptor rechazar
 * reenvíos de una captura antigua (replay).
 */
export function signWebhook(
	secret: string,
	timestamp: number,
	body: string,
): string {
	return `sha256=${createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex")}`;
}
