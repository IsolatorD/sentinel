import { type Database, schema } from "@sentinel/db";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { openAPI } from "better-auth/plugins";
import { organization } from "better-auth/plugins/organization";

export interface AuthOptions {
	db: Database;
	secret: string;
	baseURL: string;
	webOrigin: string;
	google?: { clientId: string; clientSecret: string };
	/** Envía la invitación a una organización (el correo lo arma y encola quien la implemente). */
	sendInvitation?: (input: {
		invitationId: string;
		email: string;
		role: string | null | undefined;
		organizationName: string;
		inviterName: string;
		inviterId: string;
		/** `Accept-Language` de la petición que invitó, si la hay. */
		acceptLanguage?: string | null;
	}) => Promise<void>;
}

export function createAuth(opts: AuthOptions) {
	return betterAuth({
		secret: opts.secret,
		baseURL: opts.baseURL,
		trustedOrigins: [opts.webOrigin],
		advanced: {
			// Explícito a propósito: por defecto Better Auth apaga la validación de origen
			// cuando NODE_ENV=test, y la seguridad no debe depender del entorno.
			disableOriginCheck: false,
			disableCSRFCheck: false,
		},
		database: drizzleAdapter(opts.db, { provider: "pg", schema }),
		emailAndPassword: {
			enabled: true,
			minPasswordLength: 8,
		},
		// Google solo se activa si hay credenciales configuradas.
		socialProviders: opts.google ? { google: opts.google } : {},
		plugins: [
			openAPI(),
			organization({
				creatorRole: "owner",
				sendInvitationEmail: async (data, request) => {
					await opts.sendInvitation?.({
						invitationId: data.id,
						email: data.email,
						role: data.role,
						organizationName: data.organization.name,
						inviterName: data.inviter.user.name,
						inviterId: data.inviter.user.id,
						acceptLanguage: request?.headers.get("accept-language"),
					});
				},
			}),
		],
	});
}

export type Auth = ReturnType<typeof createAuth>;
