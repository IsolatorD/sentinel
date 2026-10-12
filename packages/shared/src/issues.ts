import { z } from "zod";
import { levelSchema } from "./ingest.js";
import { ticketDtoSchema } from "./integrations.js";

export const ISSUE_STATUSES = ["unresolved", "resolved", "ignored"] as const;
export const issueStatusSchema = z.enum(ISSUE_STATUSES);
export type IssueStatus = z.infer<typeof issueStatusSchema>;

export const ISSUE_SORTS = ["lastSeen", "firstSeen", "events"] as const;

// ---------- Consulta ----------

export const paginationQuerySchema = z.object({
	limit: z.coerce.number().int().min(1).max(100).default(25),
	offset: z.coerce.number().int().min(0).default(0),
});

export const listIssuesQuerySchema = paginationQuerySchema.extend({
	/** "all" no filtra por estado. */
	status: z.enum([...ISSUE_STATUSES, "all"]).default("unresolved"),
	level: levelSchema.optional(),
	/** Busca en el título y en el culprit. */
	q: z.string().trim().min(1).max(200).optional(),
	/** Solo issues con algún evento en este entorno. */
	environment: z.string().trim().min(1).max(256).optional(),
	/** Solo issues con algún evento en esta release. */
	release: z.string().trim().min(1).max(256).optional(),
	/** `me`, `unassigned` o el id de un usuario. */
	assignee: z.string().trim().min(1).max(64).optional(),
	sort: z.enum(ISSUE_SORTS).default("lastSeen"),
	order: z.enum(["asc", "desc"]).default("desc"),
});
export type ListIssuesQuery = z.infer<typeof listIssuesQuerySchema>;

export const listIssueEventsQuerySchema = paginationQuerySchema;
export type ListIssueEventsQuery = z.infer<typeof listIssueEventsQuerySchema>;

/**
 * Cómo se resuelve un issue respecto de las releases:
 * - `next_release`: se corregirá en la próxima; solo reabre un evento de una release posterior a la actual.
 * - `release`: la corrección va en esa release; reabre un evento de ella o de una posterior.
 * Sin `resolution`, cualquier evento nuevo reabre el issue.
 */
export const resolutionSchema = z.discriminatedUnion("type", [
	z.object({ type: z.literal("next_release") }),
	z.object({
		type: z.literal("release"),
		release: z.string().trim().min(1).max(256),
	}),
]);
export type Resolution = z.infer<typeof resolutionSchema>;

export const updateIssueSchema = z
	.object({
		status: issueStatusSchema.optional(),
		resolution: resolutionSchema.optional(),
		/** Responsable del issue; `null` lo deja sin asignar. */
		assigneeId: z.string().min(1).max(64).nullable().optional(),
	})
	.refine((v) => v.status !== undefined || v.assigneeId !== undefined, {
		message: "NOTHING_TO_UPDATE",
	})
	.refine((v) => v.resolution === undefined || v.status === "resolved", {
		path: ["resolution"],
		message: "RESOLUTION_NEEDS_RESOLVED",
	});
export type UpdateIssueInput = z.infer<typeof updateIssueSchema>;

// ---------- Respuestas ----------

export const paginated = <T extends z.ZodType>(item: T) =>
	z.object({
		items: z.array(item),
		total: z.number().int(),
		limit: z.number().int(),
		offset: z.number().int(),
	});

/** Una persona tal como se muestra junto a un issue o un comentario. */
export const userRefSchema = z.object({
	id: z.string(),
	name: z.string(),
	email: z.string(),
});
export type UserRef = z.infer<typeof userRefSchema>;

export const issueDtoSchema = z.object({
	id: z.string().uuid(),
	projectId: z.string().uuid(),
	fingerprint: z.string(),
	title: z.string(),
	culprit: z.string().nullable(),
	type: z.string(),
	level: z.string(),
	status: issueStatusSchema,
	/** Responsable del issue (null = sin asignar). */
	assignee: userRefSchema.nullable(),
	/** Releases en las que apareció por primera y por última vez (null si no enviaban release). */
	firstRelease: z.string().nullable(),
	lastRelease: z.string().nullable(),
	/** Si está resuelto en función de una release: cuál, y si esa misma release ya cuenta como regresión. */
	resolvedRelease: z.string().nullable(),
	resolvedInclusive: z.boolean(),
	/** Se reabrió solo tras estar resuelto (regresión), y en qué release. */
	regressedAt: z.string().datetime().nullable(),
	regressedInRelease: z.string().nullable(),
	eventCount: z.number().int(),
	/** Usuarios distintos afectados (según el identificador del evento). */
	userCount: z.number().int(),
	firstSeen: z.string().datetime(),
	lastSeen: z.string().datetime(),
});
export type IssueDto = z.infer<typeof issueDtoSchema>;

export const eventSummaryDtoSchema = z.object({
	id: z.string().uuid(),
	issueId: z.string().uuid(),
	timestamp: z.string().datetime(),
	receivedAt: z.string().datetime(),
	level: z.string(),
	type: z.string(),
	message: z.string().nullable(),
	release: z.string().nullable(),
	environment: z.string().nullable(),
	platform: z.string().nullable(),
	userIdentifier: z.string().nullable(),
	/** Traza (32 hex) de la transacción en curso cuando se capturó, si la había. */
	traceId: z.string().nullable(),
});
export type EventSummaryDto = z.infer<typeof eventSummaryDtoSchema>;

export const eventDetailDtoSchema = eventSummaryDtoSchema.extend({
	/** Evento completo tal como lo envió el SDK (stacktrace, breadcrumbs, contexto...). */
	payload: z.record(z.string(), z.unknown()),
});
export type EventDetailDto = z.infer<typeof eventDetailDtoSchema>;

export const issueDetailDtoSchema = issueDtoSchema.extend({
	latestEvent: eventDetailDtoSchema.nullable(),
	/** Ticket de Jira ligado al issue, si lo hay. */
	ticket: ticketDtoSchema.nullable(),
});
export type IssueDetailDto = z.infer<typeof issueDetailDtoSchema>;

export const issueListDtoSchema = paginated(issueDtoSchema).extend({
	/** Eventos de las últimas 24 h por hora (24 valores), por id de issue: alimenta el gráfico de cada fila. */
	trends: z.record(z.string(), z.array(z.number().int())).default({}),
});
export type IssueListDto = z.infer<typeof issueListDtoSchema>;

export const eventListDtoSchema = paginated(eventSummaryDtoSchema);
export type EventListDto = z.infer<typeof eventListDtoSchema>;
