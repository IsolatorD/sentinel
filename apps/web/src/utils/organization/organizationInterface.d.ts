import type { z } from "zod";
import type { organizationSchema } from "@/utils/organization/organization.constants";

export type Organization = z.infer<typeof organizationSchema>;
