import { z } from "zod";
import { paginated, userRefSchema } from "./issues.js";

export const ACTIVITY_TYPES = [
	"comment",
	"status",
	"assignment",
	"ticket",
] as const;
export const activityTypeSchema = z.enum(ACTIVITY_TYPES);
export type ActivityType = z.infer<typeof activityTypeSchema>;

export const commentBodySchema = z.string().trim().min(1).max(5_000);

export const createCommentSchema = z.object({ body: commentBodySchema });
export type CreateCommentInput = z.infer<typeof createCommentSchema>;

export const updateCommentSchema = createCommentSchema;
export type UpdateCommentInput = z.infer<typeof updateCommentSchema>;

export const listActivityQuerySchema = z.object({
	limit: z.coerce.number().int().min(1).max(100).default(50),
	offset: z.coerce.number().int().min(0).default(0),
});
export type ListActivityQuery = z.infer<typeof listActivityQuerySchema>;

/**
 * Una entrada del historial. `data` según el tipo:
 * - status: `{ from, to, release? }`
 * - assignment: `{ from: {id,name}|null, to: {id,name}|null }`
 * - ticket: `{ action: "created" | "unlinked", key, url }`
 */
export const activityDtoSchema = z.object({
	id: z.string().uuid(),
	type: activityTypeSchema,
	actor: userRefSchema.nullable(),
	body: z.string().nullable(),
	data: z.record(z.string(), z.unknown()).nullable(),
	createdAt: z.string().datetime(),
	editedAt: z.string().datetime().nullable(),
});
export type ActivityDto = z.infer<typeof activityDtoSchema>;

export const activityListDtoSchema = paginated(activityDtoSchema);
export type ActivityListDto = z.infer<typeof activityListDtoSchema>;
