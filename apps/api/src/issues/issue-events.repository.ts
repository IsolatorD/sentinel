import { Inject, Injectable } from "@nestjs/common";
import { and, count, type Database, desc, eq, event } from "@sentinel/db";
import { DB } from "../database/database.module.js";

export type EventRow = typeof event.$inferSelect;

// Lectura de los eventos de un issue (la escritura la hace el worker).
@Injectable()
export class IssueEventsRepository {
	constructor(@Inject(DB) private readonly db: Database) {}

	async latest(issueId: string): Promise<EventRow | undefined> {
		const [row] = await this.db
			.select()
			.from(event)
			.where(eq(event.issueId, issueId))
			.orderBy(desc(event.timestamp), desc(event.id))
			.limit(1);
		return row;
	}

	async list(
		issueId: string,
		page: { limit: number; offset: number },
	): Promise<{ rows: EventRow[]; total: number }> {
		const [rows, [totalRow]] = await Promise.all([
			this.db
				.select()
				.from(event)
				.where(eq(event.issueId, issueId))
				.orderBy(desc(event.timestamp), desc(event.id))
				.limit(page.limit)
				.offset(page.offset),
			this.db
				.select({ n: count() })
				.from(event)
				.where(eq(event.issueId, issueId)),
		]);
		return { rows, total: totalRow.n };
	}

	async find(issueId: string, eventId: string): Promise<EventRow | undefined> {
		const [row] = await this.db
			.select()
			.from(event)
			.where(and(eq(event.issueId, issueId), eq(event.id, eventId)))
			.limit(1);
		return row;
	}
}
