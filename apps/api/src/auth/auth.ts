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
	/** Quien se registra con email y contraseña debe verificar su correo antes de entrar. */
	requireEmailVerification?: boolean;
	/** Envía el correo con el enlace de verificación (lo arma y encola quien la implemente). */
	sendVerification?: (input: {
		email: string;
		name: string;
		url: string;
		/** `Accept-Language` de la petición, si la hay. */
		acceptLanguage?: string | null;
	}) => Promise<void>;
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
			requireEmailVerification: opts.requireEmailVerification ?? false,
		},
		emailVerification: opts.requireEmailVerification
			? {
					sendOnSignUp: true,
					// Quien intenta entrar sin haber verificado recibe un enlace nuevo.
					sendOnSignIn: true,
					autoSignInAfterVerification: true,
					expiresIn: 60 * 60 * 24,
					sendVerificationEmail: async ({ user, url }, request) => {
						await opts.sendVerification?.({
							email: user.email,
							name: user.name,
							url,
							acceptLanguage: request?.headers.get("accept-language"),
						});
					},
				}
			: undefined,
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
