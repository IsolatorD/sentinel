import {
	Controller,
	Get,
	Param,
	ParseUUIDPipe,
	UseGuards,
} from "@nestjs/common";
import {
	ApiDefaultResponse,
	ApiOkResponse,
	ApiOperation,
	ApiSecurity,
	ApiTags,
} from "@nestjs/swagger";
import { AuthGuard, type AuthSession } from "../auth/auth.guard.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { docs } from "../openapi/schemas.js";
import { OrgAccessService } from "../organizations/org-access.service.js";
import { QuotaService } from "./quota.service.js";

type User = AuthSession["user"];

@ApiTags("Projects")
@ApiSecurity("session")
@ApiDefaultResponse({ description: "Error", schema: docs.error })
@Controller("organizations/:orgId/projects/:projectId/usage")
@UseGuards(AuthGuard)
export class UsageController {
	constructor(
		private readonly quota: QuotaService,
		private readonly access: OrgAccessService,
	) {}

	@Get()
	@ApiOperation({
		summary: "Uso del mes del proyecto",
		description:
			"Eventos y transacciones ingeridos este mes (UTC) frente al límite mensual, si lo hay.",
	})
	@ApiOkResponse({ schema: docs.usage })
	async usage(
		@CurrentUser() user: User,
		@Param("orgId") orgId: string,
		@Param("projectId", ParseUUIDPipe) projectId: string,
	) {
		await this.access.assert(user.id, orgId, "member");
		await this.quota.requireProject(orgId, projectId);
		return this.quota.usage(projectId);
	}
}
