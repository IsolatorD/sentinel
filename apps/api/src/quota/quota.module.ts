import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { OrganizationsModule } from "../organizations/organizations.module.js";
import { QuotaGuard } from "./quota.guard.js";
import { QuotaRepository } from "./quota.repository.js";
import { QuotaService } from "./quota.service.js";
import { UsageController } from "./usage.controller.js";

@Module({
	imports: [AuthModule, OrganizationsModule],
	controllers: [UsageController],
	providers: [QuotaRepository, QuotaService, QuotaGuard],
	exports: [QuotaService, QuotaGuard],
})
export class QuotaModule {}
