import { z } from "zod";

/** Roles que se pueden asignar al invitar o cambiar el rol de alguien (el owner se asigna al crear la organización). */
export const ASSIGNABLE_ROLES = ["member", "admin"] as const;

export const invitationSchema = z.object({
	id: z.string(),
	email: z.string(),
	role: z.string().nullable().optional(),
	status: z.string(),
	expiresAt: z.coerce.date(),
});

/** Lo que ve quien recibe una invitación antes de aceptarla. */
export const publicInvitationSchema = z.object({
	id: z.string(),
	email: z.string(),
	role: z.string().nullable().optional(),
	status: z.string(),
	organizationName: z.string(),
	organizationSlug: z.string(),
	inviterEmail: z.string(),
});
