import { z } from "zod";

export const organizationSchema = z.object({
	id: z.string(),
	name: z.string(),
	slug: z.string(),
	logo: z.string().nullish(),
});
export type Organization = z.infer<typeof organizationSchema>;
