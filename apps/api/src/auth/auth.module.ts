import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Database } from "@sentinel/db";
import { DB } from "../database/database.module";
import { createAuth } from "./auth";
import { AUTH } from "./auth.constants";
import { AuthController } from "./auth.controller";

@Module({
	controllers: [AuthController],
	providers: [
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
	exports: [AUTH],
})
export class AuthModule {}
