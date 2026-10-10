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
import { type StatsQuery, statsQuerySchema } from "@sentinel/shared";
import { AuthGuard, type AuthSession } from "../../auth/auth.guard.js";
import { CurrentUser } from "../../auth/current-user.decorator.js";
import { ZodValidationPipe } from "../../common/zod-validation.pipe.js";
import { docs } from "../../openapi/schemas.js";
import { ApiZodQuery } from "../../openapi/zod-schema.js";
import { StatsService } from "./stats.service.js";

type User = AuthSession["user"];

@ApiTags("Stats")
@ApiSecurity("session")
@ApiDefaultResponse({ description: "Error", schema: docs.error })
@Controller("organizations/:orgId/projects/:projectId")
@UseGuards(AuthGuard)
export class StatsController {
	constructor(private readonly stats: StatsService) {}

	@Get("stats")
	@ApiOperation({
		summary: "Eventos del proyecto a lo largo del tiempo",
		description:
			"Serie continua (incluye los intervalos sin eventos): `24h` por hora, `7d` cada 6 horas y `30d` por día, en UTC.",
	})
	@ApiZodQuery(statsQuerySchema)
	@ApiOkResponse({ schema: docs.stats })
	project(
		@CurrentUser() user: User,
		@Param("orgId") orgId: string,
		@Param("projectId", ParseUUIDPipe) projectId: string,
		@Query(new ZodValidationPipe(statsQuerySchema)) query: StatsQuery,
	) {
		return this.stats.project(user.id, orgId, projectId, query.period);
	}

	@Get("issues/:issueId/stats")
	@ApiOperation({ summary: "Eventos de un issue a lo largo del tiempo" })
	@ApiZodQuery(statsQuerySchema)
	@ApiOkResponse({ schema: docs.stats })
	issue(
		@CurrentUser() user: User,
		@Param("orgId") orgId: string,
		@Param("projectId", ParseUUIDPipe) projectId: string,
		@Param("issueId", ParseUUIDPipe) issueId: string,
		@Query(new ZodValidationPipe(statsQuerySchema)) query: StatsQuery,
	) {
		return this.stats.issue(user.id, orgId, projectId, issueId, query.period);
	}
}
