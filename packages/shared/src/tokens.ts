import { z } from "zod";

export const createTokenSchema = z.object({
	name: z.string().trim().min(1).max(60),
});
export type CreateTokenInput = z.infer<typeof createTokenSchema>;

export const apiTokenDtoSchema = z.object({
	id: z.string().uuid(),
	name: z.string(),
	/** Primeros caracteres: sirve para reconocerlo en la lista sin revelarlo. */
	prefix: z.string(),
	createdAt: z.string().datetime(),
	lastUsedAt: z.string().datetime().nullable(),
});
export type ApiTokenDto = z.infer<typeof apiTokenDtoSchema>;

/** Respuesta al crear un token: es la única vez que se ve el valor completo. */
export const createdApiTokenDtoSchema = apiTokenDtoSchema.extend({
	token: z.string(),
});
export type CreatedApiTokenDto = z.infer<typeof createdApiTokenDtoSchema>;

export const apiTokenListDtoSchema = z.array(apiTokenDtoSchema);
