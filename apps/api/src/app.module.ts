import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { APP_FILTER } from "@nestjs/core";
import { LoggerModule } from "nestjs-pino";
import { AuthModule } from "./auth/auth.module.js";
import { AllExceptionsFilter } from "./common/all-exceptions.filter.js";
import { buildLoggerParams } from "./common/logging.js";
import { type ApiEnv, validateApiEnv } from "./config/env.js";
import { PublicConfigModule } from "./config/public-config.module.js";
import { DatabaseModule } from "./database/database.module.js";
import { HealthModule } from "./health/health.module.js";
import { IngestModule } from "./ingest/ingest.module.js";
import { IssuesModule } from "./issues/issues.module.js";
import { OrganizationsModule } from "./organizations/organizations.module.js";
import { ProjectsModule } from "./projects/projects.module.js";
import { RedisModule } from "./redis/redis.module.js";

@Module({
	imports: [
		ConfigModule.forRoot({
			isGlobal: true,
			envFilePath: ["../../.env"],
			validate: validateApiEnv,
		}),
		LoggerModule.forRootAsync({
			inject: [ConfigService],
			useFactory: (config: ConfigService<ApiEnv, true>) =>
				buildLoggerParams({
					nodeEnv: config.get("NODE_ENV", { infer: true }),
					level: config.get("LOG_LEVEL", { infer: true }),
				}),
		}),
		DatabaseModule,
		RedisModule,
		AuthModule,
		HealthModule,
		PublicConfigModule,
		OrganizationsModule,
		ProjectsModule,
		IngestModule,
		IssuesModule,
	],
	providers: [{ provide: APP_FILTER, useClass: AllExceptionsFilter }],
})
export class AppModule {}
