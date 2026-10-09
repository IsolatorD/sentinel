import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { OrganizationsModule } from "../organizations/organizations.module.js";
import { ProjectsModule } from "../projects/projects.module.js";
import { ReleasesModule } from "../releases/releases.module.js";
import { ActivityController } from "./activity/activity.controller.js";
import { ActivityRepository } from "./activity/activity.repository.js";
import { ActivityService } from "./activity/activity.service.js";
import { IssueEventsRepository } from "./issue-events.repository.js";
import { IssuesController } from "./issues.controller.js";
import { IssuesRepository } from "./issues.repository.js";
import { IssuesService } from "./issues.service.js";

@Module({
	imports: [AuthModule, OrganizationsModule, ProjectsModule, ReleasesModule],
	controllers: [IssuesController, ActivityController],
	providers: [
		IssuesRepository,
		IssueEventsRepository,
		IssuesService,
		ActivityRepository,
		ActivityService,
	],
})
export class IssuesModule {}
