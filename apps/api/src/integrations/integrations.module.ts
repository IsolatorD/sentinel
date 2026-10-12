import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { IssuesModule } from "../issues/issues.module.js";
import { OrganizationsModule } from "../organizations/organizations.module.js";
import { ProjectsModule } from "../projects/projects.module.js";
import { FetchJiraClient } from "./fetch-jira.client.js";
import { IntegrationsController } from "./integrations.controller.js";
import { IntegrationsRepository } from "./integrations.repository.js";
import { IntegrationsService } from "./integrations.service.js";
import { JiraClient } from "./jira.client.js";

@Module({
	imports: [AuthModule, OrganizationsModule, ProjectsModule, IssuesModule],
	controllers: [IntegrationsController],
	providers: [
		IntegrationsRepository,
		IntegrationsService,
		{ provide: JiraClient, useFactory: () => new FetchJiraClient() },
	],
})
export class IntegrationsModule {}
