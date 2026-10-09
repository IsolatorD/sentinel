import type { z } from "zod";
import type { memberSchema } from "@/utils/member/member.constants";

export type OrgMember = z.infer<typeof memberSchema>;
