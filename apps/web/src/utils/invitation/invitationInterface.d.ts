import type { z } from "zod";
import type {
	ASSIGNABLE_ROLES,
	invitationSchema,
	publicInvitationSchema,
} from "@/utils/invitation/invitation.constants";

export type OrgInvitation = z.infer<typeof invitationSchema>;
export type PublicInvitation = z.infer<typeof publicInvitationSchema>;
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];
