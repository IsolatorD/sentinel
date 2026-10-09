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
	issue,
	or,
} from "@sentinel/db";
import type { IssueStatus, ListIssuesQuery } from "@sentinel/shared";
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
