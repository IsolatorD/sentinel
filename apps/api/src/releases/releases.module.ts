import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { OrganizationsModule } from "../organizations/organizations.module.js";
import { ProjectsModule } from "../projects/projects.module.js";
import { TokensModule } from "../tokens/tokens.module.js";
import { ArtifactAuthGuard } from "./artifact-auth.guard.js";
import { ArtifactsController } from "./artifacts.controller.js";
import { ArtifactsService } from "./artifacts.service.js";
import { ReleasesController } from "./releases.controller.js";
import { ReleasesRepository } from "./releases.repository.js";
import { ReleasesService } from "./releases.service.js";

@Module({
	imports: [AuthModule, OrganizationsModule, ProjectsModule, TokensModule],
	controllers: [ReleasesController, ArtifactsController],
	providers: [
		ReleasesRepository,
		ReleasesService,
		ArtifactsService,
		ArtifactAuthGuard,
	],
	exports: [ReleasesService],
})
export class ReleasesModule {}
