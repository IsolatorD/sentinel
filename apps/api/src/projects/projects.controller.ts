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
import { ProjectsService } from "./projects.service.js";

type User = AuthSession["user"];

@Controller("organizations/:orgId/projects")
@UseGuards(AuthGuard)
export class ProjectsController {
	constructor(private readonly projects: ProjectsService) {}

	@Get()
	list(@CurrentUser() user: User, @Param("orgId") orgId: string) {
		return this.projects.list(user.id, orgId);
	}

	@Post()
	create(
		@CurrentUser() user: User,
		@Param("orgId") orgId: string,
		@Body(new ZodValidationPipe(createProjectSchema)) body: CreateProjectInput,
	) {
		return this.projects.create(user.id, orgId, body);
	}

	@Get(":projectId")
	get(
		@CurrentUser() user: User,
		@Param("orgId") orgId: string,
		@Param("projectId", ParseUUIDPipe) projectId: string,
	) {
		return this.projects.get(user.id, orgId, projectId);
	}

	@Patch(":projectId")
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
	async remove(
		@CurrentUser() user: User,
		@Param("orgId") orgId: string,
		@Param("projectId", ParseUUIDPipe) projectId: string,
	) {
		await this.projects.remove(user.id, orgId, projectId);
	}

	@Post(":projectId/keys")
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
	async removeKey(
		@CurrentUser() user: User,
		@Param("orgId") orgId: string,
		@Param("projectId", ParseUUIDPipe) projectId: string,
		@Param("keyId", ParseUUIDPipe) keyId: string,
	) {
		await this.projects.removeKey(user.id, orgId, projectId, keyId);
	}
}
