import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	Param,
	ParseUUIDPipe,
	Post,
	Put,
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
import { type ConnectJiraInput, connectJiraSchema } from "@sentinel/shared";
import { AuthGuard, type AuthSession } from "../auth/auth.guard.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { docs } from "../openapi/schemas.js";
import { IntegrationsService } from "./integrations.service.js";

type User = AuthSession["user"];

@ApiTags("Integrations")
@ApiSecurity("session")
@ApiDefaultResponse({ description: "Error", schema: docs.error })
@Controller("organizations/:orgId/projects/:projectId")
@UseGuards(AuthGuard)
export class IntegrationsController {
	constructor(private readonly integrations: IntegrationsService) {}

	@Get("integrations/jira")
	@ApiOperation({
		summary: "Estado de la conexión del proyecto con Jira",
		description: "Cualquier miembro puede verlo. Nunca incluye el API token.",
	})
	@ApiOkResponse({ schema: docs.jiraConnection })
	getJira(
		@CurrentUser() user: User,
		@Param("orgId") orgId: string,
		@Param("projectId", ParseUUIDPipe) projectId: string,
	) {
		return this.integrations.getJira(user.id, orgId, projectId);
	}

	@Put("integrations/jira")
	@ApiOperation({
		summary: "Conecta (o actualiza) el proyecto con Jira Cloud",
		description:
			"Solo owner/admin. Comprueba las credenciales, el proyecto y el tipo de issue contra Jira antes de guardar. El API token se guarda cifrado; al actualizar, si se omite se conserva el guardado (solo si el sitio y el correo no cambian).",
	})
	@ApiBody({ schema: docs.connectJira })
	@ApiOkResponse({ schema: docs.jiraConnection })
	connectJira(
		@CurrentUser() user: User,
		@Param("orgId") orgId: string,
		@Param("projectId", ParseUUIDPipe) projectId: string,
		@Body(new ZodValidationPipe(connectJiraSchema)) body: ConnectJiraInput,
	) {
		return this.integrations.connectJira(user.id, orgId, projectId, body);
	}

	@Delete("integrations/jira")
	@HttpCode(204)
	@ApiOperation({
		summary: "Desconecta Jira del proyecto",
		description: "Solo owner/admin. Los tickets ya creados siguen ligados.",
	})
	@ApiNoContentResponse()
	async disconnectJira(
		@CurrentUser() user: User,
		@Param("orgId") orgId: string,
		@Param("projectId", ParseUUIDPipe) projectId: string,
	) {
		await this.integrations.disconnectJira(user.id, orgId, projectId);
	}

	@Post("issues/:issueId/ticket")
	@ApiOperation({
		summary: "Crea un ticket de Jira a partir del issue",
		description:
			"Cualquier miembro puede. El ticket lleva el título, el culprit, el nivel, los contadores y un enlace al issue. Un issue tiene como mucho un ticket.",
	})
	@ApiCreatedResponse({ schema: docs.ticket })
	createTicket(
		@CurrentUser() user: User,
		@Param("orgId") orgId: string,
		@Param("projectId", ParseUUIDPipe) projectId: string,
		@Param("issueId", ParseUUIDPipe) issueId: string,
	) {
		return this.integrations.createTicket(user.id, orgId, projectId, issueId);
	}

	@Delete("issues/:issueId/ticket")
	@HttpCode(204)
	@ApiOperation({
		summary: "Quita el vínculo del issue con su ticket",
		description: "No borra el ticket en Jira.",
	})
	@ApiNoContentResponse()
	async unlinkTicket(
		@CurrentUser() user: User,
		@Param("orgId") orgId: string,
		@Param("projectId", ParseUUIDPipe) projectId: string,
		@Param("issueId", ParseUUIDPipe) issueId: string,
	) {
		await this.integrations.unlinkTicket(user.id, orgId, projectId, issueId);
	}
}
