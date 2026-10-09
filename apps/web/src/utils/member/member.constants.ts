import { z } from "zod";

export const memberSchema = z.object({
	userId: z.string(),
	role: z.string(),
	user: z.object({ name: z.string(), email: z.string() }),
});

export const membersResponseSchema = z.object({
	members: z.array(memberSchema),
});
