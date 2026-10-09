import { z } from "zod";

/** Configuración pública que el frontend necesita conocer antes de iniciar sesión. */
export const publicConfigSchema = z.object({
	authProviders: z.object({
		/** El inicio de sesión con Google está configurado en el servidor. */
		google: z.boolean(),
	}),
});
export type PublicConfig = z.infer<typeof publicConfigSchema>;
