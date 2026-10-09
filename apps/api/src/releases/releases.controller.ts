import {
	Controller,
	Delete,
	Get,
	HttpCode,
	Param,
	ParseUUIDPipe,
	UseGuards,
} from "@nestjs/common";
import {
	ApiDefaultResponse,
	ApiNoContentResponse,
	ApiOkResponse,
	ApiOperation,
	ApiSecurity,
	ApiTags,
} from "@nestjs/swagger";
import { AuthGuard, type AuthSession } from "../auth/auth.guard.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { Notice } from "../common/notice.js";
import { docs } from "../openapi/schemas.js";
import { ReleasesService } from "./releases.service.js";

type User = AuthSession["user"];

@ApiTags("Releases")
@ApiSecurity("session")
@ApiDefaultResponse({
	description:
		"Error (401 sin sesión, 403 sin permisos, 404 si no existe o no pertenece a la organización)",
	schema: docs.error,
})
@Controller("organizations/:orgId/projects/:projectId")
@UseGuards(AuthGuard)
export class ReleasesController {
	constructor(private readonly releases: ReleasesService) {}

	@Get("releases")
	@ApiOperation({
		summary: "Lista las releases de un proyecto",
		description:
			"Las releases se registran solas al llegar el primer evento con esa versión. Incluye cuántos eventos y cuántos issues nuevos trajo cada una.",
	})
	@ApiOkResponse({ schema: docs.releaseList })
	list(
		@CurrentUser() user: User,
		@Param("orgId") orgId: string,
		@Param("projectId", ParseUUIDPipe) projectId: string,
	) {
		return this.releases.list(user.id, orgId, projectId);
	}

	@Get("releases/:version")
	@ApiOperation({ summary: "Detalle de una release" })
	@ApiOkResponse({ schema: docs.release })
	get(
		@CurrentUser() user: User,
		@Param("orgId") orgId: string,
		@Param("projectId", ParseUUIDPipe) projectId: string,
		@Param("version") version: string,
	) {
		return this.releases.get(user.id, orgId, projectId, version);
	}

	@Delete("releases/:version")
	@HttpCode(204)
	@ApiOperation({
		summary: "Borra una release",
		description:
			"Requiere rol owner o admin. Los eventos que la mencionan se conservan.",
	})
	@ApiNoContentResponse()
	@Notice({ code: "NOTICE_RELEASE_DELETED" })
	async remove(
		@CurrentUser() user: User,
		@Param("orgId") orgId: string,
		@Param("projectId", ParseUUIDPipe) projectId: string,
		@Param("version") version: string,
	) {
		await this.releases.remove(user.id, orgId, projectId, version);
	}

	@Get("environments")
	@ApiOperation({
		summary:
			"Entornos desde los que han llegado eventos (production, staging...)",
	})
	@ApiOkResponse({ schema: docs.environmentList })
	environments(
		@CurrentUser() user: User,
		@Param("orgId") orgId: string,
		@Param("projectId", ParseUUIDPipe) projectId: string,
	) {
		return this.releases.environments(user.id, orgId, projectId);
	}
}
