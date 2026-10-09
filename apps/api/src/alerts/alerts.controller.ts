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
	Query,
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
	type CreateChannelInput,
	type CreateRuleInput,
	createChannelSchema,
	createRuleSchema,
	type ListDeliveriesQuery,
	listDeliveriesQuerySchema,
	type UpdateChannelInput,
	type UpdateRuleInput,
	updateChannelSchema,
	updateRuleSchema,
} from "@sentinel/shared";
import { AuthGuard, type AuthSession } from "../auth/auth.guard.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { docs } from "../openapi/schemas.js";
import { AlertsService } from "./alerts.service.js";

type User = AuthSession["user"];

@ApiTags("Alerts")
@ApiSecurity("session")
@ApiDefaultResponse({
	description:
		"Error (401 sin sesión, 403 sin permisos, 404 si no existe o no pertenece a la organización)",
	schema: docs.error,
})
@Controller("organizations/:orgId/projects/:projectId/alerts")
@UseGuards(AuthGuard)
export class AlertsController {
	constructor(private readonly alerts: AlertsService) {}

	// ---------- Canales ----------

	@Get("channels")
	@ApiOperation({ summary: "Lista los canales de aviso del proyecto" })
	@ApiOkResponse({ schema: docs.channelList })
	listChannels(
		@CurrentUser() user: User,
		@Param("orgId") orgId: string,
		@Param("projectId", ParseUUIDPipe) projectId: string,
	) {
		return this.alerts.listChannels(user.id, orgId, projectId);
	}

	@Post("channels")
	@ApiOperation({
		summary: "Crea un canal (email, webhook o Slack)",
		description:
			'Requiere rol owner o admin. Para un webhook, la respuesta incluye una sola vez `signingSecret`: con él se firman los envíos (`X-Sentinel-Signature: sha256=HMAC(secret, "<timestamp>.<cuerpo>")`). Las URLs de webhook y Slack se guardan completas pero solo se devuelven enmascaradas.',
	})
	@ApiBody({ schema: docs.createChannel })
	@ApiCreatedResponse({ schema: docs.createdChannel })
	createChannel(
		@CurrentUser() user: User,
		@Param("orgId") orgId: string,
		@Param("projectId", ParseUUIDPipe) projectId: string,
		@Body(new ZodValidationPipe(createChannelSchema)) body: CreateChannelInput,
	) {
		return this.alerts.createChannel(user.id, orgId, projectId, body);
	}

	@Patch("channels/:channelId")
	@ApiOperation({
		summary: "Edita un canal (nombre, activo, URL o destinatarios)",
	})
	@ApiBody({ schema: docs.updateChannel })
	@ApiOkResponse({ schema: docs.channel })
	updateChannel(
		@CurrentUser() user: User,
		@Param("orgId") orgId: string,
		@Param("projectId", ParseUUIDPipe) projectId: string,
		@Param("channelId", ParseUUIDPipe) channelId: string,
		@Body(new ZodValidationPipe(updateChannelSchema)) body: UpdateChannelInput,
	) {
		return this.alerts.updateChannel(
			user.id,
			orgId,
			projectId,
			channelId,
			body,
		);
	}

	@Delete("channels/:channelId")
	@HttpCode(204)
	@ApiOperation({ summary: "Elimina un canal" })
	@ApiNoContentResponse()
	async deleteChannel(
		@CurrentUser() user: User,
		@Param("orgId") orgId: string,
		@Param("projectId", ParseUUIDPipe) projectId: string,
		@Param("channelId", ParseUUIDPipe) channelId: string,
	) {
		await this.alerts.deleteChannel(user.id, orgId, projectId, channelId);
	}

	@Post("channels/:channelId/test")
	@HttpCode(202)
	@ApiOperation({
		summary: "Envía un aviso de prueba por el canal",
		description:
			"Devuelve el envío en estado `pending`; su resultado aparece en el historial (`GET deliveries`).",
	})
	@ApiOkResponse({ schema: docs.delivery })
	testChannel(
		@CurrentUser() user: User,
		@Param("orgId") orgId: string,
		@Param("projectId", ParseUUIDPipe) projectId: string,
		@Param("channelId", ParseUUIDPipe) channelId: string,
	) {
		return this.alerts.testChannel(user.id, orgId, projectId, channelId);
	}

	// ---------- Reglas ----------

	@Get("rules")
	@ApiOperation({ summary: "Lista las reglas de alerta del proyecto" })
	@ApiOkResponse({ schema: docs.ruleList })
	listRules(
		@CurrentUser() user: User,
		@Param("orgId") orgId: string,
		@Param("projectId", ParseUUIDPipe) projectId: string,
	) {
		return this.alerts.listRules(user.id, orgId, projectId);
	}

	@Post("rules")
	@ApiOperation({
		summary: "Crea una regla de alerta",
		description:
			"`trigger`: `new_issue`, `regression` o `frequency` (esta exige `threshold` y `windowMinutes`: avisa cuando un mismo issue acumula ese número de eventos en esa ventana). `cooldownMinutes` es el mínimo entre dos avisos de la misma regla por el mismo issue. Requiere rol owner o admin.",
	})
	@ApiBody({ schema: docs.createRule })
	@ApiCreatedResponse({ schema: docs.rule })
	createRule(
		@CurrentUser() user: User,
		@Param("orgId") orgId: string,
		@Param("projectId", ParseUUIDPipe) projectId: string,
		@Body(new ZodValidationPipe(createRuleSchema)) body: CreateRuleInput,
	) {
		return this.alerts.createRule(user.id, orgId, projectId, body);
	}

	@Patch("rules/:ruleId")
	@ApiOperation({ summary: "Edita una regla" })
	@ApiBody({ schema: docs.updateRule })
	@ApiOkResponse({ schema: docs.rule })
	updateRule(
		@CurrentUser() user: User,
		@Param("orgId") orgId: string,
		@Param("projectId", ParseUUIDPipe) projectId: string,
		@Param("ruleId", ParseUUIDPipe) ruleId: string,
		@Body(new ZodValidationPipe(updateRuleSchema)) body: UpdateRuleInput,
	) {
		return this.alerts.updateRule(user.id, orgId, projectId, ruleId, body);
	}

	@Delete("rules/:ruleId")
	@HttpCode(204)
	@ApiOperation({ summary: "Elimina una regla" })
	@ApiNoContentResponse()
	async deleteRule(
		@CurrentUser() user: User,
		@Param("orgId") orgId: string,
		@Param("projectId", ParseUUIDPipe) projectId: string,
		@Param("ruleId", ParseUUIDPipe) ruleId: string,
	) {
		await this.alerts.deleteRule(user.id, orgId, projectId, ruleId);
	}

	// ---------- Historial ----------

	@Get("deliveries")
	@ApiOperation({
		summary: "Historial de avisos enviados",
		description:
			"Del más reciente al más antiguo, con su estado, intentos y el último error.",
	})
	@ApiOkResponse({ schema: docs.deliveryList })
	listDeliveries(
		@CurrentUser() user: User,
		@Param("orgId") orgId: string,
		@Param("projectId", ParseUUIDPipe) projectId: string,
		@Query(new ZodValidationPipe(listDeliveriesQuerySchema))
		query: ListDeliveriesQuery,
	) {
		return this.alerts.listDeliveries(user.id, orgId, projectId, query);
	}
}
