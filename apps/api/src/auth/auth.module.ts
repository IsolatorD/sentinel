import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Database } from "@sentinel/db";
import type { ApiEnv } from "../config/env.js";
import { DB } from "../database/database.module.js";
import { AUTH } from "./auth.constants.js";
import { AuthController } from "./auth.controller.js";
import { AuthGuard } from "./auth.guard.js";
import { createAuth } from "./auth.js";

@Module({
	controllers: [AuthController],
	providers: [
		AuthGuard,
		{
			provide: AUTH,
			inject: [DB, ConfigService],
			useFactory: (db: Database, config: ConfigService<ApiEnv, true>) => {
				const clientId = config.get("GOOGLE_CLIENT_ID", { infer: true });
				const clientSecret = config.get("GOOGLE_CLIENT_SECRET", {
					infer: true,
				});
				return createAuth({
					db,
					secret: config.get("BETTER_AUTH_SECRET", { infer: true }),
					baseURL: config.get("BETTER_AUTH_URL", { infer: true }),
					webOrigin: config.get("WEB_ORIGIN", { infer: true }),
					google:
						clientId && clientSecret ? { clientId, clientSecret } : undefined,
				});
			},
		},
	],
	exports: [AUTH, AuthGuard],
})
export class AuthModule {}
