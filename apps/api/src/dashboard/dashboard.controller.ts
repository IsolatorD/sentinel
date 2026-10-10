import {
	Controller,
	Get,
	Param,
	ParseUUIDPipe,
	Query,
	UseGuards,
} from "@nestjs/common";
import {
	ApiDefaultResponse,
	ApiOkResponse,
	ApiOperation,
	ApiSecurity,
	ApiTags,
} from "@nestjs/swagger";
import { type DashboardQuery, dashboardQuerySchema } from "@sentinel/shared";
import { AuthGuard, type AuthSession } from "../auth/auth.guard.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { docs } from "../openapi/schemas.js";
import { ApiZodQuery } from "../openapi/zod-schema.js";
import { DashboardService } from "./dashboard.service.js";

type User = AuthSession["user"];

@ApiTags("Dashboard")
@ApiSecurity("session")
@ApiDefaultResponse({ description: "Error", schema: docs.error })
@Controller("organizations/:orgId/projects/:projectId/dashboard")
@UseGuards(AuthGuard)
export class DashboardController {
	constructor(private readonly dashboard: DashboardService) {}

	@Get()
	@ApiOperation({
		summary: "Estadísticas del proyecto en un periodo",
		description:
			"Totales (eventos, usuarios afectados, issues nuevos y resueltos, transacciones, p95, errores) con su comparación contra el periodo anterior, series por intervalo, repartos por nivel, entorno y release, los issues con más eventos y las transacciones más lentas.",
	})
	@ApiZodQuery(dashboardQuerySchema)
	@ApiOkResponse({ schema: docs.dashboard })
	get(
		@CurrentUser() user: User,
		@Param("orgId") orgId: string,
		@Param("projectId", ParseUUIDPipe) projectId: string,
		@Query(new ZodValidationPipe(dashboardQuerySchema)) query: DashboardQuery,
	) {
		return this.dashboard.get(user.id, orgId, projectId, query);
	}
}
