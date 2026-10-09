import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { OrganizationsModule } from "../organizations/organizations.module.js";
import { ProjectsController } from "./projects.controller.js";
import { ProjectsRepository } from "./projects.repository.js";
import { ProjectsService } from "./projects.service.js";

@Module({
	imports: [AuthModule, OrganizationsModule],
	controllers: [ProjectsController],
	providers: [ProjectsRepository, ProjectsService],
	exports: [ProjectsService],
})
export class ProjectsModule {}
