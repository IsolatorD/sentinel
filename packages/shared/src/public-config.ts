import { z } from "zod";

/** Configuración pública que el frontend necesita conocer antes de iniciar sesión. */
export const publicConfigSchema = z.object({
	authProviders: z.object({
		/** El inicio de sesión con Google está configurado en el servidor. */
		google: z.boolean(),
	}),
	/** El servidor puede enviar correos (SMTP configurado): sin esto, los canales de email no entregan. */
	emailEnabled: z.boolean(),
	/** Quien se registra con email y contraseña debe verificar su correo antes de entrar. */
	emailVerification: z.boolean(),
	/** Se puede crear una cuenta nueva (el servidor no cerró el registro). */
	signUpEnabled: z.boolean(),
	/** DSN con la que la web de esta instancia reporta sus propios errores (`null` = no lo hace). */
	monitoringDsn: z.string().nullable(),
});
export type PublicConfig = z.infer<typeof publicConfigSchema>;
