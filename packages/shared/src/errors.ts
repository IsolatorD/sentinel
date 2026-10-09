import { z } from "zod";

// Formato único de error de la API.
export const errorResponseSchema = z.object({
	statusCode: z.number().int(),
	code: z.string(),
	message: z.string(),
	issues: z
		.array(z.object({ path: z.string(), message: z.string() }))
		.optional(),
	requestId: z.string().optional(),
});
export type ErrorResponse = z.infer<typeof errorResponseSchema>;
