import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { OrganizationsModule } from "../organizations/organizations.module.js";
import { ProjectsModule } from "../projects/projects.module.js";
import { DashboardController } from "./dashboard.controller.js";
import { DashboardRepository } from "./dashboard.repository.js";
import { DashboardService } from "./dashboard.service.js";

@Module({
	imports: [AuthModule, OrganizationsModule, ProjectsModule],
	controllers: [DashboardController],
	providers: [DashboardRepository, DashboardService],
})
export class DashboardModule {}
