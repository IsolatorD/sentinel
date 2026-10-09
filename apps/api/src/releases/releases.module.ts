import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { OrganizationsModule } from "../organizations/organizations.module.js";
import { ProjectsModule } from "../projects/projects.module.js";
import { ReleasesController } from "./releases.controller.js";
import { ReleasesRepository } from "./releases.repository.js";
import { ReleasesService } from "./releases.service.js";

@Module({
	imports: [AuthModule, OrganizationsModule, ProjectsModule],
	controllers: [ReleasesController],
	providers: [ReleasesRepository, ReleasesService],
	exports: [ReleasesService],
})
export class ReleasesModule {}
