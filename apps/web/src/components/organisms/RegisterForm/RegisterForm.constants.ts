import { z } from "zod";

export const schema = z.object({
	name: z.string().trim().min(1),
	email: z.string().trim().min(1).email(),
	password: z.string().min(8),
});
