import { z } from "zod";

export const releaseDtoSchema = z.object({
	version: z.string(),
	createdAt: z.string().datetime(),
	/** Eventos recibidos con esta release. */
	eventCount: z.number().int(),
	/** Issues que aparecieron por primera vez en esta release. */
	newIssueCount: z.number().int(),
	/** Archivos (source maps) subidos para esta release. */
	artifactCount: z.number().int(),
	firstEventAt: z.string().datetime().nullable(),
	lastEventAt: z.string().datetime().nullable(),
});
export type ReleaseDto = z.infer<typeof releaseDtoSchema>;

export const releaseListDtoSchema = z.array(releaseDtoSchema);

export const environmentListDtoSchema = z.array(z.string());
