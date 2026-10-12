import { z } from "zod";

/** Jira Cloud: `https://<sitio>.atlassian.net`. Solo se aceptan sitios de Atlassian, nunca hosts arbitrarios. */
const JIRA_HOST = /^[a-z0-9][a-z0-9-]*\.atlassian\.net$/i;

/** Devuelve el origen normalizado del sitio, o `null` si no es un sitio de Jira Cloud. */
export function normalizeJiraSite(value: string): string | null {
	let url: URL;
	try {
		url = new URL(value.trim());
	} catch {
		return null;
	}
	if (url.protocol !== "https:" || !JIRA_HOST.test(url.hostname)) return null;
	if (url.username || url.password || url.port) return null;
	return `https://${url.hostname.toLowerCase()}`;
}

export const JIRA_KEY = /^[A-Z][A-Z0-9_]{1,9}$/;

export const jiraSiteSchema = z
	.string()
	.trim()
	.max(200)
	.superRefine((value, ctx) => {
		if (!normalizeJiraSite(value))
			ctx.addIssue({ code: "custom", message: "JIRA_SITE_INVALID" });
	})
	.transform((value) => normalizeJiraSite(value) as string);

export const connectJiraSchema = z.object({
	siteUrl: jiraSiteSchema,
	email: z.string().trim().email().max(254),
	/** Obligatorio al conectar; al editar, si se omite se conserva el guardado. */
	apiToken: z.string().trim().min(1).max(500).optional(),
	projectKey: z
		.string()
		.trim()
		.toUpperCase()
		.refine((v) => JIRA_KEY.test(v), "JIRA_KEY_INVALID"),
	issueType: z.string().trim().min(1).max(60).default("Bug"),
});
export type ConnectJiraInput = z.infer<typeof connectJiraSchema>;

/** Estado de la conexión; nunca incluye el token. */
export const jiraConnectionDtoSchema = z.object({
	connected: z.boolean(),
	siteUrl: z.string().nullable(),
	email: z.string().nullable(),
	projectKey: z.string().nullable(),
	issueType: z.string().nullable(),
});
export type JiraConnectionDto = z.infer<typeof jiraConnectionDtoSchema>;

/** Ticket externo ligado a un issue. */
export const ticketDtoSchema = z.object({
	provider: z.literal("jira"),
	key: z.string(),
	url: z.string().url(),
	createdAt: z.string().datetime(),
	/** Quién lo creó (como `UserRef` de los issues). */
	createdBy: z
		.object({ id: z.string(), name: z.string(), email: z.string() })
		.nullable(),
});
export type TicketDto = z.infer<typeof ticketDtoSchema>;
