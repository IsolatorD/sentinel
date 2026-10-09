import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { NOTIFICATIONS_QUEUE } from "@sentinel/shared";
import { AuthModule } from "../auth/auth.module.js";
import { OrganizationsModule } from "../organizations/organizations.module.js";
import { ProjectsModule } from "../projects/projects.module.js";
import { AlertsController } from "./alerts.controller.js";
import { AlertsRepository } from "./alerts.repository.js";
import { AlertsService } from "./alerts.service.js";

@Module({
	imports: [
		AuthModule,
		OrganizationsModule,
		ProjectsModule,
		BullModule.registerQueue({ name: NOTIFICATIONS_QUEUE }),
	],
	controllers: [AlertsController],
	providers: [AlertsRepository, AlertsService],
})
export class AlertsModule {}
