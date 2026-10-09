import {
	BadRequestException,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import type {
	EventDetailDto,
	EventListDto,
	EventSummaryDto,
	IssueDetailDto,
	IssueDto,
	IssueListDto,
	ListIssueEventsQuery,
	ListIssuesQuery,
	UpdateIssueInput,
	UserRef,
} from "@sentinel/shared";
import { OrgAccessService } from "../organizations/org-access.service.js";
import { ProjectsService } from "../projects/projects.service.js";
import { ReleasesService } from "../releases/releases.service.js";
import { ActivityService } from "./activity/activity.service.js";
import {
	type EventRow,
	IssueEventsRepository,
} from "./issue-events.repository.js";
import { type IssueRow, IssuesRepository } from "./issues.repository.js";

const toIssueDto = (
	row: IssueRow,
	userCount: number,
	assignee: UserRef | null = null,
): IssueDto => ({
	id: row.id,
	projectId: row.projectId,
	fingerprint: row.fingerprint,
	title: row.title,
	culprit: row.culprit,
	type: row.type,
	level: row.level,
	status: row.status as IssueDto["status"],
	assignee,
	firstRelease: row.firstRelease,
	lastRelease: row.lastRelease,
	resolvedRelease: row.resolvedRelease,
	resolvedInclusive: row.resolvedInclusive,
	regressedAt: row.regressedAt ? row.regressedAt.toISOString() : null,
	regressedInRelease: row.regressedInRelease,
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
		private readonly releases: ReleasesService,
		private readonly activity: ActivityService,
	) {}

	async list(
		userId: string,
		orgId: string,
		projectId: string,
		query: ListIssuesQuery,
	): Promise<IssueListDto> {
		await this.authorize(userId, orgId, projectId, "member");
		// "me" se resuelve aquí: el repositorio solo conoce ids de usuario.
		const resolved = {
			...query,
			assignee: query.assignee === "me" ? userId : query.assignee,
		};
		const { rows, total } = await this.issues.list(projectId, resolved);
		const [users, people] = await Promise.all([
			this.issues.userCounts(rows.map((r) => r.id)),
			this.issues.assignees(rows.map((r) => r.assigneeId)),
		]);
		return {
			items: rows.map((r) =>
				toIssueDto(
					r,
					users.get(r.id) ?? 0,
					r.assigneeId ? (people.get(r.assigneeId) ?? null) : null,
				),
			),
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
		const [users, latest, people] = await Promise.all([
			this.issues.userCounts([issueId]),
			this.events.latest(issueId),
			this.issues.assignees([row.assigneeId]),
		]);
		return {
			...toIssueDto(
				row,
				users.get(issueId) ?? 0,
				row.assigneeId ? (people.get(row.assigneeId) ?? null) : null,
			),
			latestEvent: latest ? toEventDetail(latest) : null,
		};
	}

	/** Compatibilidad: cambiar solo el estado es un caso de `update`. */
	updateStatus(
		userId: string,
		orgId: string,
		projectId: string,
		issueId: string,
		input: UpdateIssueInput,
	): Promise<IssueDto> {
		return this.update(userId, orgId, projectId, issueId, input);
	}

	/**
	 * Resolver, ignorar o asignar es trabajo de triage: lo puede hacer cualquier miembro.
	 * Al resolver se puede ligar a una release (ver `resolutionSchema`):
	 * - "próxima release": la referencia es la última release conocida y reabre una posterior.
	 *   Si el proyecto aún no tiene releases no hay referencia, y cualquier evento reabrirá el issue.
	 * - "release X": la corrección va en X, y la propia X ya cuenta como regresión.
	 * Cada cambio queda en el historial del issue con quién lo hizo.
	 */
	async update(
		userId: string,
		orgId: string,
		projectId: string,
		issueId: string,
		input: UpdateIssueInput,
	): Promise<IssueDto> {
		await this.authorize(userId, orgId, projectId, "member");
		const before = await this.requireIssue(projectId, issueId);
		let row = before;

		if (input.status !== undefined) {
			let resolvedRelease: string | null = null;
			let resolvedInclusive = false;
			if (input.status === "resolved" && input.resolution) {
				if (input.resolution.type === "release") {
					resolvedRelease = input.resolution.release;
					resolvedInclusive = true;
					// Se registra para poder ordenarla por fecha si su versión no es semver.
					await this.releases.ensure(projectId, resolvedRelease);
				} else {
					resolvedRelease =
						(await this.releases.latestVersion(projectId)) ?? null;
				}
			}
			const updated = await this.issues.updateStatus(projectId, issueId, {
				status: input.status,
				resolvedRelease,
				resolvedInclusive,
			});
			if (!updated) throw new NotFoundException({ reason: "ISSUE_NOT_FOUND" });
			row = updated;
			if (before.status !== input.status) {
				await this.activity.record(issueId, userId, "status", {
					from: before.status,
					to: input.status,
					...(resolvedRelease && {
						release: resolvedRelease,
						inclusive: resolvedInclusive,
					}),
				});
			}
		}

		if (
			input.assigneeId !== undefined &&
			input.assigneeId !== before.assigneeId
		) {
			// Solo se puede asignar a quien es miembro de la organización.
			if (
				input.assigneeId &&
				!(await this.access.has(input.assigneeId, orgId, "member"))
			) {
				throw new BadRequestException({ reason: "ASSIGNEE_NOT_MEMBER" });
			}
			const updated = await this.issues.setAssignee(
				projectId,
				issueId,
				input.assigneeId,
			);
			if (!updated) throw new NotFoundException({ reason: "ISSUE_NOT_FOUND" });
			row = updated;
			const people = await this.issues.assignees([
				before.assigneeId,
				input.assigneeId,
			]);
			const ref = (id: string | null) => {
				const person = id ? people.get(id) : undefined;
				return person ? { id: person.id, name: person.name } : null;
			};
			await this.activity.record(issueId, userId, "assignment", {
				from: ref(before.assigneeId),
				to: ref(input.assigneeId),
			});
		}

		const [users, people] = await Promise.all([
			this.issues.userCounts([issueId]),
			this.issues.assignees([row.assigneeId]),
		]);
		return toIssueDto(
			row,
			users.get(issueId) ?? 0,
			row.assigneeId ? (people.get(row.assigneeId) ?? null) : null,
		);
	}

	async remove(
		userId: string,
		orgId: string,
		projectId: string,
		issueId: string,
	): Promise<void> {
		await this.authorize(userId, orgId, projectId, "admin");
		if (!(await this.issues.delete(projectId, issueId))) {
			throw new NotFoundException({ reason: "ISSUE_NOT_FOUND" });
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
		if (!row) throw new NotFoundException({ reason: "EVENT_NOT_FOUND" });
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
		if (!row) throw new NotFoundException({ reason: "ISSUE_NOT_FOUND" });
		return row;
	}
}
