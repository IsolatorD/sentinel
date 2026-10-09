import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	Param,
	ParseUUIDPipe,
	Patch,
	Post,
	UseGuards,
} from "@nestjs/common";
import {
	ApiBody,
	ApiCreatedResponse,
	ApiDefaultResponse,
	ApiNoContentResponse,
	ApiOkResponse,
	ApiOperation,
	ApiSecurity,
	ApiTags,
} from "@nestjs/swagger";
import {
	type CreateProjectInput,
	type CreateProjectKeyInput,
	createProjectKeySchema,
	createProjectSchema,
	type UpdateProjectInput,
	type UpdateProjectKeyInput,
	updateProjectKeySchema,
	updateProjectSchema,
} from "@sentinel/shared";
import { AuthGuard, type AuthSession } from "../auth/auth.guard.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { docs } from "../openapi/schemas.js";
import { ProjectsService } from "./projects.service.js";

type User = AuthSession["user"];

@ApiTags("Projects")
@ApiSecurity("session")
@ApiDefaultResponse({
	description:
		"Error (401 sin sesión, 403 sin permisos, 404 si no existe o no pertenece a la organización)",
	schema: docs.error,
})
@Controller("organizations/:orgId/projects")
@UseGuards(AuthGuard)
export class ProjectsController {
	constructor(private readonly projects: ProjectsService) {}

	@Get()
	@ApiOperation({ summary: "Lista los proyectos de una organización" })
	@ApiOkResponse({ schema: docs.projectList })
	list(@CurrentUser() user: User, @Param("orgId") orgId: string) {
		return this.projects.list(user.id, orgId);
	}

	@Post()
	@ApiOperation({
		summary: "Crea un proyecto (y su primera clave DSN)",
		description: "Requiere rol owner o admin.",
	})
	@ApiBody({ schema: docs.createProject })
	@ApiCreatedResponse({ schema: docs.project })
	create(
		@CurrentUser() user: User,
		@Param("orgId") orgId: string,
		@Body(new ZodValidationPipe(createProjectSchema)) body: CreateProjectInput,
	) {
		return this.projects.create(user.id, orgId, body);
	}

	@Get(":projectId")
	@ApiOperation({ summary: "Detalle de un proyecto, con sus claves DSN" })
	@ApiOkResponse({ schema: docs.project })
	get(
		@CurrentUser() user: User,
		@Param("orgId") orgId: string,
		@Param("projectId", ParseUUIDPipe) projectId: string,
	) {
		return this.projects.get(user.id, orgId, projectId);
	}

	@Patch(":projectId")
	@ApiOperation({
		summary: "Renombra un proyecto o cambia su plataforma",
		description: "Requiere rol owner o admin.",
	})
	@ApiBody({ schema: docs.updateProject })
	@ApiOkResponse({ schema: docs.project })
	update(
		@CurrentUser() user: User,
		@Param("orgId") orgId: string,
		@Param("projectId", ParseUUIDPipe) projectId: string,
		@Body(new ZodValidationPipe(updateProjectSchema)) body: UpdateProjectInput,
	) {
		return this.projects.update(user.id, orgId, projectId, body);
	}

	@Delete(":projectId")
	@HttpCode(204)
	@ApiOperation({
		summary: "Borra un proyecto con sus claves, issues y eventos",
		description: "Requiere rol owner o admin.",
	})
	@ApiNoContentResponse()
	async remove(
		@CurrentUser() user: User,
		@Param("orgId") orgId: string,
		@Param("projectId", ParseUUIDPipe) projectId: string,
	) {
		await this.projects.remove(user.id, orgId, projectId);
	}

	@Post(":projectId/keys")
	@ApiOperation({
		summary: "Crea una clave DSN",
		description: "Requiere rol owner o admin.",
	})
	@ApiBody({ schema: docs.createKey })
	@ApiCreatedResponse({ schema: docs.projectKey })
	createKey(
		@CurrentUser() user: User,
		@Param("orgId") orgId: string,
		@Param("projectId", ParseUUIDPipe) projectId: string,
		@Body(new ZodValidationPipe(createProjectKeySchema))
		body: CreateProjectKeyInput,
	) {
		return this.projects.createKey(user.id, orgId, projectId, body);
	}

	@Patch(":projectId/keys/:keyId")
	@ApiOperation({
		summary: "Renombra o revoca una clave DSN",
		description:
			"Requiere rol owner o admin. `isActive: false` revoca la clave.",
	})
	@ApiBody({ schema: docs.updateKey })
	@ApiOkResponse({ schema: docs.projectKey })
	updateKey(
		@CurrentUser() user: User,
		@Param("orgId") orgId: string,
		@Param("projectId", ParseUUIDPipe) projectId: string,
		@Param("keyId", ParseUUIDPipe) keyId: string,
		@Body(new ZodValidationPipe(updateProjectKeySchema))
		body: UpdateProjectKeyInput,
	) {
		return this.projects.updateKey(user.id, orgId, projectId, keyId, body);
	}

	@Delete(":projectId/keys/:keyId")
	@HttpCode(204)
	@ApiOperation({
		summary: "Borra una clave DSN",
		description: "Requiere rol owner o admin.",
	})
	@ApiNoContentResponse()
	async removeKey(
		@CurrentUser() user: User,
		@Param("orgId") orgId: string,
		@Param("projectId", ParseUUIDPipe) projectId: string,
		@Param("keyId", ParseUUIDPipe) keyId: string,
	) {
		await this.projects.removeKey(user.id, orgId, projectId, keyId);
	}
}
