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
			}),
		],
	});
}

export type Auth = ReturnType<typeof createAuth>;
