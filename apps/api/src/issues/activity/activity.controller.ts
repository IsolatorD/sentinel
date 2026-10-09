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
	type CreateCommentInput,
	createCommentSchema,
	type ListActivityQuery,
	listActivityQuerySchema,
	type UpdateCommentInput,
	updateCommentSchema,
} from "@sentinel/shared";
import { AuthGuard, type AuthSession } from "../../auth/auth.guard.js";
import { CurrentUser } from "../../auth/current-user.decorator.js";
import { ZodValidationPipe } from "../../common/zod-validation.pipe.js";
import { docs } from "../../openapi/schemas.js";
import { ApiZodQuery } from "../../openapi/zod-schema.js";
import { ActivityService } from "./activity.service.js";

type User = AuthSession["user"];

@ApiTags("Issues")
@ApiSecurity("session")
@ApiDefaultResponse({
	description:
		"Error (401 sin sesión, 403 sin permisos, 404 si no existe o no pertenece a la organización)",
	schema: docs.error,
})
@Controller("organizations/:orgId/projects/:projectId/issues/:issueId")
@UseGuards(AuthGuard)
export class ActivityController {
	constructor(private readonly activity: ActivityService) {}

	@Get("activity")
	@ApiOperation({
		summary:
			"Historial de un issue: comentarios y cambios de estado o asignación",
		description: "Del más reciente al más antiguo.",
	})
	@ApiZodQuery(listActivityQuerySchema)
	@ApiOkResponse({ schema: docs.activityList })
	list(
		@CurrentUser() user: User,
		@Param("orgId") orgId: string,
		@Param("projectId", ParseUUIDPipe) projectId: string,
		@Param("issueId", ParseUUIDPipe) issueId: string,
		@Query(new ZodValidationPipe(listActivityQuerySchema))
		query: ListActivityQuery,
	) {
		return this.activity.list(user.id, orgId, projectId, issueId, query);
	}

	@Post("comments")
	@ApiOperation({
		summary: "Comenta un issue",
		description: "Cualquier miembro.",
	})
	@ApiBody({ schema: docs.createComment })
	@ApiCreatedResponse({ schema: docs.activity })
	comment(
		@CurrentUser() user: User,
		@Param("orgId") orgId: string,
		@Param("projectId", ParseUUIDPipe) projectId: string,
		@Param("issueId", ParseUUIDPipe) issueId: string,
		@Body(new ZodValidationPipe(createCommentSchema)) body: CreateCommentInput,
	) {
		return this.activity.comment(user.id, orgId, projectId, issueId, body.body);
	}

	@Patch("comments/:commentId")
	@ApiOperation({
		summary: "Edita un comentario",
		description: "Solo su autor.",
	})
	@ApiBody({ schema: docs.createComment })
	@ApiOkResponse({ schema: docs.activity })
	editComment(
		@CurrentUser() user: User,
		@Param("orgId") orgId: string,
		@Param("projectId", ParseUUIDPipe) projectId: string,
		@Param("issueId", ParseUUIDPipe) issueId: string,
		@Param("commentId", ParseUUIDPipe) commentId: string,
		@Body(new ZodValidationPipe(updateCommentSchema)) body: UpdateCommentInput,
	) {
		return this.activity.editComment(
			user.id,
			orgId,
			projectId,
			issueId,
			commentId,
			body.body,
		);
	}

	@Delete("comments/:commentId")
	@HttpCode(204)
	@ApiOperation({
		summary: "Borra un comentario",
		description: "Su autor, o un owner/admin.",
	})
	@ApiNoContentResponse()
	async deleteComment(
		@CurrentUser() user: User,
		@Param("orgId") orgId: string,
		@Param("projectId", ParseUUIDPipe) projectId: string,
		@Param("issueId", ParseUUIDPipe) issueId: string,
		@Param("commentId", ParseUUIDPipe) commentId: string,
	) {
		await this.activity.deleteComment(
			user.id,
			orgId,
			projectId,
			issueId,
			commentId,
		);
	}
}
