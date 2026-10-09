import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AuthModule } from "./auth/auth.module.js";
import { DatabaseModule } from "./database/database.module.js";
import { HealthModule } from "./health/health.module.js";
import { IngestModule } from "./ingest/ingest.module.js";
import { OrganizationsModule } from "./organizations/organizations.module.js";
import { ProjectsModule } from "./projects/projects.module.js";
import { RedisModule } from "./redis/redis.module.js";

@Module({
	imports: [
		ConfigModule.forRoot({ isGlobal: true, envFilePath: ["../../.env"] }),
		DatabaseModule,
		RedisModule,
		AuthModule,
		HealthModule,
		OrganizationsModule,
		ProjectsModule,
		IngestModule,
	],
})
export class AppModule {}
