import { Module } from "@nestjs/common";
import { OrgAccessService } from "./org-access.service.js";
import { OrganizationsRepository } from "./organizations.repository.js";

@Module({
	providers: [OrganizationsRepository, OrgAccessService],
	exports: [OrgAccessService],
})
export class OrganizationsModule {}
