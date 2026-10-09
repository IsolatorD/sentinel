import { z } from "zod";

// Formato único de error de la API.
export const errorResponseSchema = z.object({
	statusCode: z.number().int(),
	/** Código genérico (según el estado HTTP). */
	code: z.string(),
	/** Código estable y específico del mensaje (`ISSUE_NOT_FOUND`): el frontend lo traduce si hace falta. */
	reason: z.string().optional(),
	message: z.string(),
	issues: z
		.array(z.object({ path: z.string(), message: z.string() }))
		.optional(),
	requestId: z.string().optional(),
});
export type ErrorResponse = z.infer<typeof errorResponseSchema>;
