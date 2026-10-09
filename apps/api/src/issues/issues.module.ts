import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { OrganizationsModule } from "../organizations/organizations.module.js";
import { ProjectsModule } from "../projects/projects.module.js";
import { IssueEventsRepository } from "./issue-events.repository.js";
import { IssuesController } from "./issues.controller.js";
import { IssuesRepository } from "./issues.repository.js";
import { IssuesService } from "./issues.service.js";

@Module({
	imports: [AuthModule, OrganizationsModule, ProjectsModule],
	controllers: [IssuesController],
	providers: [IssuesRepository, IssueEventsRepository, IssuesService],
})
export class IssuesModule {}
