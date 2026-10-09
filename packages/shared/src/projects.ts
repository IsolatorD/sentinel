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

export interface ProjectKeyDto {
	id: string;
	projectId: string;
	label: string;
	publicKey: string;
	isActive: boolean;
	dsn: string;
	createdAt: string;
}

export interface ProjectDto {
	id: string;
	organizationId: string;
	name: string;
	slug: string;
	platform: string;
	createdAt: string;
	keys?: ProjectKeyDto[];
}
