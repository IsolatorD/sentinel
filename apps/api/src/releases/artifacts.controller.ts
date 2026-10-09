import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	Param,
	ParseUUIDPipe,
	Put,
	Query,
	Req,
	UseGuards,
} from "@nestjs/common";
import {
	ApiBearerAuth,
	ApiConsumes,
	ApiCreatedResponse,
	ApiDefaultResponse,
	ApiNoContentResponse,
	ApiOkResponse,
	ApiOperation,
	ApiQuery,
	ApiSecurity,
	ApiTags,
} from "@nestjs/swagger";
import { AuthGuard, type AuthSession } from "../auth/auth.guard.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { docs } from "../openapi/schemas.js";
import {
	ArtifactAuthGuard,
	type ArtifactRequest,
} from "./artifact-auth.guard.js";
import { ArtifactsService } from "./artifacts.service.js";

type User = AuthSession["user"];

@ApiTags("Releases")
@ApiDefaultResponse({ description: "Error", schema: docs.error })
@Controller(
	"organizations/:orgId/projects/:projectId/releases/:version/artifacts",
)
export class ArtifactsController {
	constructor(private readonly artifacts: ArtifactsService) {}

	@Get()
	@UseGuards(AuthGuard)
	@ApiSecurity("session")
	@ApiOperation({
		summary: "Lista los archivos (source maps) subidos para una release",
	})
	@ApiOkResponse({ schema: docs.artifactList })
	list(
		@CurrentUser() user: User,
		@Param("orgId") orgId: string,
		@Param("projectId", ParseUUIDPipe) projectId: string,
		@Param("version") version: string,
	) {
		return this.artifacts.list(user.id, orgId, projectId, version);
	}

	@Put()
	@HttpCode(201)
	@UseGuards(ArtifactAuthGuard)
	@ApiBearerAuth()
	@ApiSecurity("session")
	@ApiConsumes("application/octet-stream")
	@ApiOperation({
		summary: "Sube el source map de un archivo minificado",
		description:
			"El cuerpo es el `.map` tal cual (`Content-Type: application/octet-stream`, hasta 25 MB). `name` es la ruta del archivo minificado, con `~` por el origen (p. ej. `~/assets/app.3f2a.js`). Si ya existía un mapa con ese nombre en la release, se reemplaza. Se autentica con `Authorization: Bearer <token>` (token de API de la organización) o con la sesión de un owner/admin. Los eventos que lleguen después con esta release se simbolizan solos.",
	})
	@ApiQuery({
		name: "name",
		required: true,
		description: "Ruta del archivo minificado, p. ej. ~/assets/app.js",
	})
	@ApiCreatedResponse({ schema: docs.artifact })
	upload(
		@Req() request: ArtifactRequest,
		@Param("orgId") orgId: string,
		@Param("projectId", ParseUUIDPipe) projectId: string,
		@Param("version") version: string,
		@Query("name") name: string | undefined,
		@Body() body: unknown,
	) {
		return this.artifacts.upload(
			request.actor,
			orgId,
			projectId,
			version,
			name,
			body,
		);
	}

	@Delete(":artifactId")
	@HttpCode(204)
	@UseGuards(AuthGuard)
	@ApiSecurity("session")
	@ApiOperation({
		summary: "Borra un archivo de la release",
		description: "Requiere rol owner o admin.",
	})
	@ApiNoContentResponse()
	async remove(
		@CurrentUser() user: User,
		@Param("orgId") orgId: string,
		@Param("projectId", ParseUUIDPipe) projectId: string,
		@Param("version") version: string,
		@Param("artifactId", ParseUUIDPipe) artifactId: string,
	) {
		await this.artifacts.remove(user.id, orgId, projectId, version, artifactId);
	}
}
