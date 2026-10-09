import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	Param,
	ParseUUIDPipe,
	Patch,
	Query,
	UseGuards,
} from "@nestjs/common";
import {
	ApiBody,
	ApiDefaultResponse,
	ApiNoContentResponse,
	ApiOkResponse,
	ApiOperation,
	ApiSecurity,
	ApiTags,
} from "@nestjs/swagger";
import {
	type ListIssueEventsQuery,
	type ListIssuesQuery,
	listIssueEventsQuerySchema,
	listIssuesQuerySchema,
	type UpdateIssueInput,
	updateIssueSchema,
} from "@sentinel/shared";
import { AuthGuard, type AuthSession } from "../auth/auth.guard.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { Notice } from "../common/notice.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { docs } from "../openapi/schemas.js";
import { ApiZodQuery } from "../openapi/zod-schema.js";
import { issueUpdatedNotice } from "./domain/notices.js";
import { IssuesService } from "./issues.service.js";

type User = AuthSession["user"];

@ApiTags("Issues")
@ApiSecurity("session")
@ApiDefaultResponse({
	description:
		"Error (401 sin sesión, 403 sin permisos, 404 si no existe o no pertenece a la organización)",
	schema: docs.error,
})
@Controller("organizations/:orgId/projects/:projectId/issues")
@UseGuards(AuthGuard)
export class IssuesController {
	constructor(private readonly issues: IssuesService) {}

	@Get()
	@ApiOperation({
		summary: "Lista los issues de un proyecto",
		description:
			"Por defecto devuelve los no resueltos, del más reciente al más antiguo. Admite filtros, búsqueda en título y culprit, orden y paginación.",
	})
	@ApiZodQuery(listIssuesQuerySchema)
	@ApiOkResponse({ schema: docs.issueList })
	list(
		@CurrentUser() user: User,
		@Param("orgId") orgId: string,
		@Param("projectId", ParseUUIDPipe) projectId: string,
		@Query(new ZodValidationPipe(listIssuesQuerySchema)) query: ListIssuesQuery,
	) {
		return this.issues.list(user.id, orgId, projectId, query);
	}

	@Get(":issueId")
	@ApiOperation({
		summary: "Detalle de un issue, con su último evento completo",
	})
	@ApiOkResponse({ schema: docs.issueDetail })
	get(
		@CurrentUser() user: User,
		@Param("orgId") orgId: string,
		@Param("projectId", ParseUUIDPipe) projectId: string,
		@Param("issueId", ParseUUIDPipe) issueId: string,
	) {
		return this.issues.get(user.id, orgId, projectId, issueId);
	}

	@Patch(":issueId")
	@ApiOperation({
		summary: "Cambia el estado o el responsable de un issue",
		description:
			"Cualquier miembro puede hacerlo. `assigneeId` asigna el issue a un miembro de la organización (`null` lo deja sin asignar); cada cambio queda en el historial del issue. Al resolver se puede indicar `resolution`: `next_release` (se corregirá en la próxima; solo reabre un evento de una release posterior a la actual) o `{ type: 'release', release }` (la corrección va en esa release). Sin `resolution`, cualquier evento nuevo reabre el issue (una regresión).",
	})
	@ApiBody({ schema: docs.updateIssue })
	@ApiOkResponse({ schema: docs.issue })
	@Notice(issueUpdatedNotice)
	update(
		@CurrentUser() user: User,
		@Param("orgId") orgId: string,
		@Param("projectId", ParseUUIDPipe) projectId: string,
		@Param("issueId", ParseUUIDPipe) issueId: string,
		@Body(new ZodValidationPipe(updateIssueSchema)) body: UpdateIssueInput,
	) {
		return this.issues.update(user.id, orgId, projectId, issueId, body);
	}

	@Delete(":issueId")
	@HttpCode(204)
	@ApiOperation({
		summary: "Borra un issue y todos sus eventos",
		description: "Requiere rol owner o admin.",
	})
	@ApiNoContentResponse()
	@Notice({ code: "NOTICE_ISSUE_DELETED" })
	async remove(
		@CurrentUser() user: User,
		@Param("orgId") orgId: string,
		@Param("projectId", ParseUUIDPipe) projectId: string,
		@Param("issueId", ParseUUIDPipe) issueId: string,
	) {
		await this.issues.remove(user.id, orgId, projectId, issueId);
	}

	@Get(":issueId/events")
	@ApiOperation({
		summary:
			"Lista los eventos de un issue (resumen, del más reciente al más antiguo)",
	})
	@ApiZodQuery(listIssueEventsQuerySchema)
	@ApiOkResponse({ schema: docs.eventList })
	listEvents(
		@CurrentUser() user: User,
		@Param("orgId") orgId: string,
		@Param("projectId", ParseUUIDPipe) projectId: string,
		@Param("issueId", ParseUUIDPipe) issueId: string,
		@Query(new ZodValidationPipe(listIssueEventsQuerySchema))
		query: ListIssueEventsQuery,
	) {
		return this.issues.listEvents(user.id, orgId, projectId, issueId, query);
	}

	@Get(":issueId/events/:eventId")
	@ApiOperation({ summary: "Detalle completo de un evento" })
	@ApiOkResponse({ schema: docs.eventDetail })
	getEvent(
		@CurrentUser() user: User,
		@Param("orgId") orgId: string,
		@Param("projectId", ParseUUIDPipe) projectId: string,
		@Param("issueId", ParseUUIDPipe) issueId: string,
		@Param("eventId", ParseUUIDPipe) eventId: string,
	) {
		return this.issues.getEvent(user.id, orgId, projectId, issueId, eventId);
	}
}
