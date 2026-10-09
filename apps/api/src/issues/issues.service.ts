import { Injectable, NotFoundException } from "@nestjs/common";
import type {
	EventDetailDto,
	EventListDto,
	EventSummaryDto,
	IssueDetailDto,
	IssueDto,
	IssueListDto,
	IssueStatus,
	ListIssueEventsQuery,
	ListIssuesQuery,
} from "@sentinel/shared";
import { OrgAccessService } from "../organizations/org-access.service.js";
import { ProjectsService } from "../projects/projects.service.js";
import {
	type EventRow,
	IssueEventsRepository,
} from "./issue-events.repository.js";
import { type IssueRow, IssuesRepository } from "./issues.repository.js";

const toIssueDto = (row: IssueRow, userCount: number): IssueDto => ({
	id: row.id,
	projectId: row.projectId,
	fingerprint: row.fingerprint,
	title: row.title,
	culprit: row.culprit,
	type: row.type,
	level: row.level,
	status: row.status as IssueStatus,
	eventCount: row.eventCount,
	userCount,
	firstSeen: row.firstSeen.toISOString(),
	lastSeen: row.lastSeen.toISOString(),
});

const toEventSummary = (row: EventRow): EventSummaryDto => ({
	id: row.id,
	issueId: row.issueId,
	timestamp: row.timestamp.toISOString(),
	receivedAt: row.receivedAt.toISOString(),
	level: row.level,
	type: row.type,
	message: row.message,
	release: row.release,
	environment: row.environment,
	platform: row.platform,
	userIdentifier: row.userIdentifier,
});

const toEventDetail = (row: EventRow): EventDetailDto => ({
	...toEventSummary(row),
	payload: row.payload as Record<string, unknown>,
});

@Injectable()
export class IssuesService {
	constructor(
		private readonly issues: IssuesRepository,
		private readonly events: IssueEventsRepository,
		private readonly access: OrgAccessService,
		private readonly projects: ProjectsService,
	) {}

	async list(
		userId: string,
		orgId: string,
		projectId: string,
		query: ListIssuesQuery,
	): Promise<IssueListDto> {
		await this.authorize(userId, orgId, projectId, "member");
		const { rows, total } = await this.issues.list(projectId, query);
		const users = await this.issues.userCounts(rows.map((r) => r.id));
		return {
			items: rows.map((r) => toIssueDto(r, users.get(r.id) ?? 0)),
			total,
			limit: query.limit,
			offset: query.offset,
		};
	}

	async get(
		userId: string,
		orgId: string,
		projectId: string,
		issueId: string,
	): Promise<IssueDetailDto> {
		await this.authorize(userId, orgId, projectId, "member");
		const row = await this.requireIssue(projectId, issueId);
		const [users, latest] = await Promise.all([
			this.issues.userCounts([issueId]),
			this.events.latest(issueId),
		]);
		return {
			...toIssueDto(row, users.get(issueId) ?? 0),
			latestEvent: latest ? toEventDetail(latest) : null,
		};
	}

	/** Resolver o ignorar es trabajo de triage: lo puede hacer cualquier miembro. */
	async updateStatus(
		userId: string,
		orgId: string,
		projectId: string,
		issueId: string,
		status: IssueStatus,
	): Promise<IssueDto> {
		await this.authorize(userId, orgId, projectId, "member");
		const row = await this.issues.updateStatus(projectId, issueId, status);
		if (!row) throw new NotFoundException("Issue not found");
		const users = await this.issues.userCounts([issueId]);
		return toIssueDto(row, users.get(issueId) ?? 0);
	}

	async remove(
		userId: string,
		orgId: string,
		projectId: string,
		issueId: string,
	): Promise<void> {
		await this.authorize(userId, orgId, projectId, "admin");
		if (!(await this.issues.delete(projectId, issueId))) {
			throw new NotFoundException("Issue not found");
		}
	}

	async listEvents(
		userId: string,
		orgId: string,
		projectId: string,
		issueId: string,
		query: ListIssueEventsQuery,
	): Promise<EventListDto> {
		await this.authorize(userId, orgId, projectId, "member");
		await this.requireIssue(projectId, issueId);
		const { rows, total } = await this.events.list(issueId, query);
		return {
			items: rows.map(toEventSummary),
			total,
			limit: query.limit,
			offset: query.offset,
		};
	}

	async getEvent(
		userId: string,
		orgId: string,
		projectId: string,
		issueId: string,
		eventId: string,
	): Promise<EventDetailDto> {
		await this.authorize(userId, orgId, projectId, "member");
		await this.requireIssue(projectId, issueId);
		const row = await this.events.find(issueId, eventId);
		if (!row) throw new NotFoundException("Event not found");
		return toEventDetail(row);
	}

	// ---------- Helpers ----------

	/** Permiso en la organización y el proyecto pertenece a ella (si no, 404). */
	private async authorize(
		userId: string,
		orgId: string,
		projectId: string,
		level: "member" | "admin",
	): Promise<void> {
		await this.access.assert(userId, orgId, level);
		await this.projects.ensureExists(orgId, projectId);
	}

	private async requireIssue(
		projectId: string,
		issueId: string,
	): Promise<IssueRow> {
		const row = await this.issues.findInProject(projectId, issueId);
		if (!row) throw new NotFoundException("Issue not found");
		return row;
	}
}
