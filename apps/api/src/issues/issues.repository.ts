import { Inject, Injectable } from "@nestjs/common";
import {
	and,
	asc,
	count,
	countDistinct,
	type Database,
	desc,
	eq,
	event,
	exists,
	ilike,
	inArray,
	isNull,
	issue,
	issueTicket,
	or,
	organization,
	project,
	user,
} from "@sentinel/db";
import type {
	IssueStatus,
	ListIssuesQuery,
	TicketDto,
	UserRef,
} from "@sentinel/shared";
import { DB } from "../database/database.module.js";
import { containsPattern } from "./domain/search.js";

export type IssueRow = typeof issue.$inferSelect;

export interface StatusChange {
	status: IssueStatus;
	resolvedRelease: string | null;
	resolvedInclusive: boolean;
}

// Única capa que conoce Drizzle para issues.
@Injectable()
export class IssuesRepository {
	constructor(@Inject(DB) private readonly db: Database) {}

	async list(
		projectId: string,
		query: ListIssuesQuery,
	): Promise<{ rows: IssueRow[]; total: number }> {
		const pattern = query.q ? containsPattern(query.q) : undefined;

		// Entorno y release viven en los eventos: se filtra por "tiene algún evento que cumpla".
		const eventFilters = [
			query.environment ? eq(event.environment, query.environment) : undefined,
			query.release ? eq(event.release, query.release) : undefined,
		].filter((f) => f !== undefined);
		const byEvents =
			eventFilters.length > 0
				? exists(
						this.db
							.select({ one: event.id })
							.from(event)
							.where(and(eq(event.issueId, issue.id), ...eventFilters)),
					)
				: undefined;

		const where = and(
			eq(issue.projectId, projectId),
			query.status === "all" ? undefined : eq(issue.status, query.status),
			query.level ? eq(issue.level, query.level) : undefined,
			query.assignee === "unassigned"
				? isNull(issue.assigneeId)
				: query.assignee
					? eq(issue.assigneeId, query.assignee)
					: undefined,
			pattern
				? or(ilike(issue.title, pattern), ilike(issue.culprit, pattern))
				: undefined,
			byEvents,
		);

		const sortColumn = {
			lastSeen: issue.lastSeen,
			firstSeen: issue.firstSeen,
			events: issue.eventCount,
		}[query.sort];
		const direction = query.order === "asc" ? asc : desc;

		const [rows, [totalRow]] = await Promise.all([
			this.db
				.select()
				.from(issue)
				// El id desempata para que la paginación sea estable.
				.orderBy(direction(sortColumn), desc(issue.id))
				.where(where)
				.limit(query.limit)
				.offset(query.offset),
			this.db.select({ n: count() }).from(issue).where(where),
		]);
		return { rows, total: totalRow.n };
	}

	/** Usuarios distintos por issue, en una sola consulta agrupada. */
	async userCounts(issueIds: string[]): Promise<Map<string, number>> {
		if (issueIds.length === 0) return new Map();
		const rows = await this.db
			.select({
				issueId: event.issueId,
				users: countDistinct(event.userIdentifier),
			})
			.from(event)
			.where(inArray(event.issueId, issueIds))
			.groupBy(event.issueId);
		return new Map(rows.map((r) => [r.issueId, r.users]));
	}

	/** Datos de las personas asignadas, para mostrar su nombre junto al issue. */
	async assignees(
		userIds: Array<string | null>,
	): Promise<Map<string, UserRef>> {
		const ids = [...new Set(userIds.filter((id): id is string => Boolean(id)))];
		if (ids.length === 0) return new Map();
		const rows = await this.db
			.select({ id: user.id, name: user.name, email: user.email })
			.from(user)
			.where(inArray(user.id, ids));
		return new Map(rows.map((r) => [r.id, r]));
	}

	/** Ticket externo ligado al issue, con quién lo creó. */
	async ticket(issueId: string): Promise<TicketDto | null> {
		const [row] = await this.db
			.select({
				key: issueTicket.externalKey,
				url: issueTicket.externalUrl,
				createdAt: issueTicket.createdAt,
				creator: { id: user.id, name: user.name, email: user.email },
			})
			.from(issueTicket)
			.leftJoin(user, eq(user.id, issueTicket.createdBy))
			.where(eq(issueTicket.issueId, issueId));
		if (!row) return null;
		return {
			provider: "jira",
			key: row.key,
			url: row.url,
			createdAt: row.createdAt.toISOString(),
			createdBy: row.creator?.id ? row.creator : null,
		};
	}

	/** Nombre y slug del proyecto y de su organización, para escribir enlaces y correos. */
	async notificationContext(
		projectId: string,
	): Promise<
		{ projectName: string; projectSlug: string; orgSlug: string } | undefined
	> {
		const [row] = await this.db
			.select({
				projectName: project.name,
				projectSlug: project.slug,
				orgSlug: organization.slug,
			})
			.from(project)
			.innerJoin(organization, eq(organization.id, project.organizationId))
			.where(eq(project.id, projectId))
			.limit(1);
		return row;
	}

	async setAssignee(
		projectId: string,
		issueId: string,
		assigneeId: string | null,
	): Promise<IssueRow | undefined> {
		const [row] = await this.db
			.update(issue)
			.set({ assigneeId })
			.where(and(eq(issue.id, issueId), eq(issue.projectId, projectId)))
			.returning();
		return row;
	}

	async findInProject(
		projectId: string,
		issueId: string,
	): Promise<IssueRow | undefined> {
		const [row] = await this.db
			.select()
			.from(issue)
			.where(and(eq(issue.id, issueId), eq(issue.projectId, projectId)))
			.limit(1);
		return row;
	}

	/**
	 * Cambio manual de estado. Al resolver se guarda la release asociada (si la hay), y siempre
	 * se limpia la marca de regresión: la persona ya ha revisado el issue.
	 */
	async updateStatus(
		projectId: string,
		issueId: string,
		change: StatusChange,
	): Promise<IssueRow | undefined> {
		const [row] = await this.db
			.update(issue)
			.set({
				status: change.status,
				resolvedRelease:
					change.status === "resolved" ? change.resolvedRelease : null,
				resolvedInclusive:
					change.status === "resolved" ? change.resolvedInclusive : false,
				regressedAt: null,
				regressedInRelease: null,
			})
			.where(and(eq(issue.id, issueId), eq(issue.projectId, projectId)))
			.returning();
		return row;
	}

	async delete(projectId: string, issueId: string): Promise<boolean> {
		const rows = await this.db
			.delete(issue)
			.where(and(eq(issue.id, issueId), eq(issue.projectId, projectId)))
			.returning({ id: issue.id });
		return rows.length > 0;
	}
}
