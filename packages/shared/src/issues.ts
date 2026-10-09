import { z } from "zod";
import { levelSchema } from "./ingest.js";

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
	sort: z.enum(ISSUE_SORTS).default("lastSeen"),
	order: z.enum(["asc", "desc"]).default("desc"),
});
export type ListIssuesQuery = z.infer<typeof listIssuesQuerySchema>;

export const listIssueEventsQuerySchema = paginationQuerySchema;
export type ListIssueEventsQuery = z.infer<typeof listIssueEventsQuerySchema>;

export const updateIssueSchema = z.object({ status: issueStatusSchema });
export type UpdateIssueInput = z.infer<typeof updateIssueSchema>;

// ---------- Respuestas ----------

export const paginated = <T extends z.ZodType>(item: T) =>
	z.object({
		items: z.array(item),
		total: z.number().int(),
		limit: z.number().int(),
		offset: z.number().int(),
	});

export const issueDtoSchema = z.object({
	id: z.string().uuid(),
	projectId: z.string().uuid(),
	fingerprint: z.string(),
	title: z.string(),
	culprit: z.string().nullable(),
	type: z.string(),
	level: z.string(),
	status: issueStatusSchema,
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
});
export type EventSummaryDto = z.infer<typeof eventSummaryDtoSchema>;

export const eventDetailDtoSchema = eventSummaryDtoSchema.extend({
	/** Evento completo tal como lo envió el SDK (stacktrace, breadcrumbs, contexto...). */
	payload: z.record(z.string(), z.unknown()),
});
export type EventDetailDto = z.infer<typeof eventDetailDtoSchema>;

export const issueDetailDtoSchema = issueDtoSchema.extend({
	latestEvent: eventDetailDtoSchema.nullable(),
});
export type IssueDetailDto = z.infer<typeof issueDetailDtoSchema>;

export const issueListDtoSchema = paginated(issueDtoSchema);
export type IssueListDto = z.infer<typeof issueListDtoSchema>;

export const eventListDtoSchema = paginated(eventSummaryDtoSchema);
export type EventListDto = z.infer<typeof eventListDtoSchema>;
