import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { OrganizationsModule } from "../organizations/organizations.module.js";
import { ProjectsModule } from "../projects/projects.module.js";
import { PerformanceController } from "./performance.controller.js";
import { PerformanceRepository } from "./performance.repository.js";
import { PerformanceService } from "./performance.service.js";

@Module({
	imports: [AuthModule, OrganizationsModule, ProjectsModule],
	controllers: [PerformanceController],
	providers: [PerformanceRepository, PerformanceService],
})
export class PerformanceModule {}
