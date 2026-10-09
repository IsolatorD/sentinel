import {
	ForbiddenException,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import type {
	ActivityDto,
	ActivityListDto,
	ActivityType,
	ListActivityQuery,
} from "@sentinel/shared";
import { OrgAccessService } from "../../organizations/org-access.service.js";
import { ProjectsService } from "../../projects/projects.service.js";
import { IssuesRepository } from "../issues.repository.js";
import { ActivityRepository, type ActivityRow } from "./activity.repository.js";

const toDto = ({ activity, actor }: ActivityRow): ActivityDto => ({
	id: activity.id,
	type: activity.type as ActivityType,
	actor,
	body: activity.body,
	data: activity.data,
	createdAt: activity.createdAt.toISOString(),
	editedAt: activity.editedAt ? activity.editedAt.toISOString() : null,
});

@Injectable()
export class ActivityService {
	constructor(
		private readonly activity: ActivityRepository,
		private readonly issues: IssuesRepository,
		private readonly access: OrgAccessService,
		private readonly projects: ProjectsService,
	) {}

	/** Anota un cambio hecho por una persona (lo usa IssuesService). */
	async record(
		issueId: string,
		userId: string,
		type: Exclude<ActivityType, "comment">,
		data: Record<string, unknown>,
	): Promise<void> {
		await this.activity.create({ issueId, userId, type, data });
	}

	async list(
		userId: string,
		orgId: string,
		projectId: string,
		issueId: string,
		query: ListActivityQuery,
	): Promise<ActivityListDto> {
		await this.authorize(userId, orgId, projectId, issueId);
		const { rows, total } = await this.activity.list(
			issueId,
			query.limit,
			query.offset,
		);
		return {
			items: rows.map(toDto),
			total,
			limit: query.limit,
			offset: query.offset,
		};
	}

	async comment(
		userId: string,
		orgId: string,
		projectId: string,
		issueId: string,
		body: string,
	): Promise<ActivityDto> {
		await this.authorize(userId, orgId, projectId, issueId);
		const created = await this.activity.create({
			issueId,
			userId,
			type: "comment",
			body,
		});
		return toDto(
			(await this.activity.find(issueId, created.id)) as ActivityRow,
		);
	}

	/** Solo quien lo escribió puede editarlo. */
	async editComment(
		userId: string,
		orgId: string,
		projectId: string,
		issueId: string,
		commentId: string,
		body: string,
	): Promise<ActivityDto> {
		await this.authorize(userId, orgId, projectId, issueId);
		const row = await this.requireComment(issueId, commentId);
		if (row.activity.userId !== userId)
			throw new ForbiddenException("Only the author can edit a comment");
		await this.activity.updateBody(commentId, body);
		return toDto((await this.activity.find(issueId, commentId)) as ActivityRow);
	}

	/** El autor puede borrar el suyo; un owner o admin puede borrar cualquiera. */
	async deleteComment(
		userId: string,
		orgId: string,
		projectId: string,
		issueId: string,
		commentId: string,
	): Promise<void> {
		await this.authorize(userId, orgId, projectId, issueId);
		const row = await this.requireComment(issueId, commentId);
		const isAuthor = row.activity.userId === userId;
		if (!isAuthor && !(await this.access.has(userId, orgId, "admin")))
			throw new ForbiddenException("Insufficient permissions");
		await this.activity.delete(commentId);
	}

	private async authorize(
		userId: string,
		orgId: string,
		projectId: string,
		issueId: string,
	): Promise<void> {
		await this.access.assert(userId, orgId, "member");
		await this.projects.ensureExists(orgId, projectId);
		if (!(await this.issues.findInProject(projectId, issueId)))
			throw new NotFoundException("Issue not found");
	}

	/** Solo los comentarios se editan o borran a mano; el resto del historial es un registro. */
	private async requireComment(
		issueId: string,
		commentId: string,
	): Promise<ActivityRow> {
		const row = await this.activity.find(issueId, commentId);
		if (row?.activity.type !== "comment")
			throw new NotFoundException("Comment not found");
		return row;
	}
}
