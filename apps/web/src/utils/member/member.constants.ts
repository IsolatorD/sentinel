import { z } from "zod";

export const memberSchema = z.object({
	/** Id de la membresía (no del usuario): lo piden cambiar el rol y quitar. */
	id: z.string(),
	userId: z.string(),
	role: z.string(),
	createdAt: z.coerce.date(),
	user: z.object({ name: z.string(), email: z.string() }),
});

export const membersResponseSchema = z.object({
	members: z.array(memberSchema),
});
