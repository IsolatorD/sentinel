import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { MailModule } from "../mail/mail.module.js";
import { OrganizationsModule } from "../organizations/organizations.module.js";
import { PreferencesModule } from "../preferences/preferences.module.js";
import { ProjectsModule } from "../projects/projects.module.js";
import { ReleasesModule } from "../releases/releases.module.js";
import { ActivityController } from "./activity/activity.controller.js";
import { ActivityRepository } from "./activity/activity.repository.js";
import { ActivityService } from "./activity/activity.service.js";
import { AssignmentNotifier } from "./assignment-notifier.js";
import { IssueEventsRepository } from "./issue-events.repository.js";
import { IssuesController } from "./issues.controller.js";
import { IssuesRepository } from "./issues.repository.js";
import { IssuesService } from "./issues.service.js";
import { StatsController } from "./stats/stats.controller.js";
import { StatsRepository } from "./stats/stats.repository.js";
import { StatsService } from "./stats/stats.service.js";

@Module({
	imports: [
		AuthModule,
		OrganizationsModule,
		ProjectsModule,
		ReleasesModule,
		MailModule,
		PreferencesModule,
	],
	controllers: [IssuesController, ActivityController, StatsController],
	providers: [
		IssuesRepository,
		IssueEventsRepository,
		IssuesService,
		AssignmentNotifier,
		ActivityRepository,
		ActivityService,
		StatsRepository,
		StatsService,
	],
	exports: [ActivityService],
})
export class IssuesModule {}
