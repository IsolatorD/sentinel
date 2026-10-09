import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Database } from "@sentinel/db";
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
			useFactory: (db: Database, config: ConfigService) => {
				const clientId = config.get<string>("GOOGLE_CLIENT_ID");
				const clientSecret = config.get<string>("GOOGLE_CLIENT_SECRET");
				const port = config.get<string>("API_PORT", "3000");
				return createAuth({
					db,
					secret: config.getOrThrow<string>("BETTER_AUTH_SECRET"),
					baseURL: config.get<string>(
						"BETTER_AUTH_URL",
						`http://localhost:${port}`,
					),
					webOrigin: config.get<string>("WEB_ORIGIN", "http://localhost:5173"),
					google:
						clientId && clientSecret ? { clientId, clientSecret } : undefined,
				});
			},
		},
	],
	exports: [AUTH, AuthGuard],
})
export class AuthModule {}
