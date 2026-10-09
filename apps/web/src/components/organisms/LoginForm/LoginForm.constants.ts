import { z } from "zod";

export const credentialsSchema = z.object({
	email: z.string().trim().min(1, "required").email("email"),
	password: z.string().min(1, "required"),
});
