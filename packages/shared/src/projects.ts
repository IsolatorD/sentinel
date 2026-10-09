import { z } from "zod";

export const PLATFORMS = [
	"javascript",
	"react",
	"node",
	"react-native",
	"python",
	"other",
] as const;

export const platformSchema = z.enum(PLATFORMS);
export type Platform = z.infer<typeof platformSchema>;

const nameSchema = z.string().trim().min(1).max(80);
const labelSchema = z.string().trim().min(1).max(60);

export const createProjectSchema = z.object({
	name: nameSchema,
	platform: platformSchema.default("javascript"),
});
export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export const updateProjectSchema = z
	.object({
		name: nameSchema.optional(),
		platform: platformSchema.optional(),
	})
	.refine((v) => v.name !== undefined || v.platform !== undefined, {
		message: "Provide at least one field to update",
	});
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

export const createProjectKeySchema = z.object({
	label: labelSchema.default("Default"),
});
export type CreateProjectKeyInput = z.infer<typeof createProjectKeySchema>;

export const updateProjectKeySchema = z
	.object({
		label: labelSchema.optional(),
		isActive: z.boolean().optional(),
	})
	.refine((v) => v.label !== undefined || v.isActive !== undefined, {
		message: "Provide at least one field to update",
	});
export type UpdateProjectKeyInput = z.infer<typeof updateProjectKeySchema>;

export const projectKeyDtoSchema = z.object({
	id: z.string().uuid(),
	projectId: z.string().uuid(),
	label: z.string(),
	publicKey: z.string(),
	isActive: z.boolean(),
	dsn: z.string(),
	createdAt: z.string().datetime(),
});
export type ProjectKeyDto = z.infer<typeof projectKeyDtoSchema>;

export const projectDtoSchema = z.object({
	id: z.string().uuid(),
	organizationId: z.string(),
	name: z.string(),
	slug: z.string(),
	platform: z.string(),
	createdAt: z.string().datetime(),
	keys: z.array(projectKeyDtoSchema).optional(),
});
export type ProjectDto = z.infer<typeof projectDtoSchema>;
