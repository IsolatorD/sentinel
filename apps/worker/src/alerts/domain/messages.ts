import { createHmac } from "node:crypto";
import { ALERT_TRIGGER_EVENT, type AlertPayload } from "@sentinel/shared";

const escapeHtml = (text: string) =>
	text
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;");

const clip = (text: string, max: number) =>
	text.length > max ? `${text.slice(0, max - 1)}…` : text;

/** Frase corta que explica por qué llegó el aviso. */
export function headline(payload: AlertPayload): string {
	if (payload.kind === "test") return "Test alert from Sentinel";
	const { issue, frequency } = payload;
	switch (payload.trigger) {
		case "new_issue":
			return "New issue";
		case "regression":
			return issue.regressedInRelease
				? `Regression in ${issue.regressedInRelease}`
				: "Regression";
		case "frequency":
			return frequency
				? `${frequency.count} events in ${formatWindow(frequency.windowMinutes)}`
				: "High frequency";
	}
}

function formatWindow(minutes: number): string {
	if (minutes % 1440 === 0)
		return `${minutes / 1440} day${minutes === 1440 ? "" : "s"}`;
	if (minutes % 60 === 0)
		return `${minutes / 60} hour${minutes === 60 ? "" : "s"}`;
	return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}

/** Líneas "Etiqueta: valor" con lo más útil del issue. */
function details(payload: AlertPayload): Array<[string, string]> {
	const { issue } = payload;
	const rows: Array<[string, string]> = [
		["Project", payload.project.name],
		["Level", issue.level],
	];
	if (issue.culprit) rows.push(["Where", issue.culprit]);
	if (issue.environment) rows.push(["Environment", issue.environment]);
	if (issue.release) rows.push(["Release", issue.release]);
	rows.push(["Events", String(issue.eventCount)]);
	rows.push(["Rule", payload.ruleName]);
	return rows;
}

export function emailContent(payload: AlertPayload): {
	subject: string;
	text: string;
	html: string;
} {
	const title = clip(payload.issue.title, 150);
	const subject = `[${payload.project.name}] ${headline(payload)}: ${title}`;
	const rows = details(payload);
	const text = [
		headline(payload),
		"",
		title,
		"",
		...rows.map(([k, v]) => `${k}: ${v}`),
		"",
		`View the issue: ${payload.url}`,
		"",
		`You receive this because of the alert rule "${payload.ruleName}" in ${payload.organization.name}.`,
	].join("\n");
	const html = `<div style="font-family:system-ui,sans-serif;max-width:560px;color:#2b2233">
<p style="margin:0 0 4px;font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:#6b6078">${escapeHtml(headline(payload))}</p>
<h2 style="margin:0 0 16px;font-size:18px;line-height:1.3">${escapeHtml(title)}</h2>
<table style="border-collapse:collapse;font-size:14px;margin-bottom:20px">
${rows.map(([k, v]) => `<tr><td style="padding:3px 16px 3px 0;color:#6b6078">${escapeHtml(k)}</td><td style="padding:3px 0">${escapeHtml(v)}</td></tr>`).join("\n")}
</table>
<p><a href="${escapeHtml(payload.url)}" style="display:inline-block;background:#6c5fc7;color:#fff;text-decoration:none;padding:9px 16px;border-radius:6px;font-size:14px">View the issue</a></p>
<p style="font-size:12px;color:#8b8199">You receive this because of the alert rule “${escapeHtml(payload.ruleName)}” in ${escapeHtml(payload.organization.name)}.</p>
</div>`;
	return { subject, text, html };
}

/** Mensaje para un webhook entrante de Slack (también lo aceptan Discord y Teams en modo Slack). */
export function slackBody(payload: AlertPayload) {
	const title = clip(payload.issue.title, 150);
	const fields = details(payload)
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
