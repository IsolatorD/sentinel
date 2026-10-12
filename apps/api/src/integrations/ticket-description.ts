export interface TicketIssue {
	title: string;
	culprit: string | null;
	level: string;
	eventCount: number;
	firstSeen: Date;
	lastSeen: Date;
	lastRelease: string | null;
}

const clip = (text: string, max: number) =>
	text.length > max ? `${text.slice(0, max - 1)}…` : text;

/** Resumen del ticket: el título del issue, sin saltos de línea y dentro del límite de Jira (255). */
export const ticketSummary = (title: string): string =>
	clip(title.replace(/\s+/g, " ").trim(), 250);

const text = (value: string, marks?: unknown[]) => ({
	type: "text",
	text: value,
	...(marks && { marks }),
});
const paragraph = (...content: unknown[]) => ({ type: "paragraph", content });

/**
 * Descripción del ticket en Atlassian Document Format (el único formato que acepta la API v3):
 * qué pasó, cuánto y dónde, y un enlace de vuelta al issue en Sentinel.
 */
export function ticketDescription(issue: TicketIssue, url: string) {
	const facts: string[] = [
		`Level: ${issue.level}`,
		`Events: ${issue.eventCount}`,
		`First seen: ${issue.firstSeen.toISOString()}`,
		`Last seen: ${issue.lastSeen.toISOString()}`,
	];
	if (issue.lastRelease) facts.push(`Release: ${issue.lastRelease}`);
	return {
		type: "doc",
		version: 1,
		content: [
			paragraph(text(clip(issue.title, 1_000))),
			...(issue.culprit
				? [paragraph(text(`Where: ${clip(issue.culprit, 500)}`))]
				: []),
			{
				type: "bulletList",
				content: facts.map((fact) => ({
					type: "listItem",
					content: [paragraph(text(fact))],
				})),
			},
			paragraph(
				text("Open in Sentinel", [{ type: "link", attrs: { href: url } }]),
			),
		],
	};
}
