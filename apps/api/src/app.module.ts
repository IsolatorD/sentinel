import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { APP_FILTER, APP_INTERCEPTOR } from "@nestjs/core";
import { LoggerModule } from "nestjs-pino";
import { AlertsModule } from "./alerts/alerts.module.js";
import { AuthModule } from "./auth/auth.module.js";
import { AllExceptionsFilter } from "./common/all-exceptions.filter.js";
import { buildLoggerParams } from "./common/logging.js";
import { NoticeInterceptor } from "./common/notice.js";
import { type ApiEnv, validateApiEnv } from "./config/env.js";
import { PublicConfigModule } from "./config/public-config.module.js";
import { DashboardModule } from "./dashboard/dashboard.module.js";
import { DatabaseModule } from "./database/database.module.js";
import { HealthModule } from "./health/health.module.js";
import { IngestModule } from "./ingest/ingest.module.js";
import { IssuesModule } from "./issues/issues.module.js";
import { OrganizationsModule } from "./organizations/organizations.module.js";
import { PerformanceModule } from "./performance/performance.module.js";
import { PreferencesModule } from "./preferences/preferences.module.js";
import { ProjectsModule } from "./projects/projects.module.js";
import { QuotaModule } from "./quota/quota.module.js";
import { RedisModule } from "./redis/redis.module.js";
import { ReleasesModule } from "./releases/releases.module.js";
import { TokensModule } from "./tokens/tokens.module.js";

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
		PerformanceModule,
		DashboardModule,
		QuotaModule,
		ReleasesModule,
		AlertsModule,
		PreferencesModule,
		TokensModule,
	],
	providers: [
		{ provide: APP_FILTER, useClass: AllExceptionsFilter },
		{ provide: APP_INTERCEPTOR, useClass: NoticeInterceptor },
	],
})
export class AppModule {}
