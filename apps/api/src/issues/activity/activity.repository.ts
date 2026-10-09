import { Inject, Injectable } from "@nestjs/common";
import {
	and,
	count,
	type Database,
	desc,
	eq,
	issueActivity,
	user,
} from "@sentinel/db";
import type { ActivityType } from "@sentinel/shared";
import { DB } from "../../database/database.module.js";

export interface ActivityRow {
	activity: typeof issueActivity.$inferSelect;
	actor: { id: string; name: string; email: string } | null;
}

// Única capa que conoce Drizzle para el historial de un issue.
@Injectable()
export class ActivityRepository {
	constructor(@Inject(DB) private readonly db: Database) {}

	/** Del más reciente al más antiguo. */
	async list(
		issueId: string,
		limit: number,
		offset: number,
	): Promise<{ rows: ActivityRow[]; total: number }> {
		const where = eq(issueActivity.issueId, issueId);
		const [rows, [totalRow]] = await Promise.all([
			this.db
				.select({
					activity: issueActivity,
					actor: { id: user.id, name: user.name, email: user.email },
				})
				.from(issueActivity)
				.leftJoin(user, eq(user.id, issueActivity.userId))
				.where(where)
				.orderBy(desc(issueActivity.createdAt), desc(issueActivity.id))
				.limit(limit)
				.offset(offset),
			this.db.select({ n: count() }).from(issueActivity).where(where),
		]);
		return {
			rows: rows.map((r) => ({
				activity: r.activity,
				actor: r.actor?.id ? r.actor : null,
			})),
			total: totalRow?.n ?? 0,
		};
	}

	async find(issueId: string, id: string): Promise<ActivityRow | undefined> {
		const [row] = await this.db
			.select({
				activity: issueActivity,
				actor: { id: user.id, name: user.name, email: user.email },
			})
			.from(issueActivity)
			.leftJoin(user, eq(user.id, issueActivity.userId))
			.where(and(eq(issueActivity.issueId, issueId), eq(issueActivity.id, id)));
		return row
			? { activity: row.activity, actor: row.actor?.id ? row.actor : null }
			: undefined;
	}

	async create(values: {
		issueId: string;
		userId: string;
		type: ActivityType;
		body?: string;
		data?: Record<string, unknown>;
	}): Promise<typeof issueActivity.$inferSelect> {
		const [row] = await this.db
			.insert(issueActivity)
			.values(values)
			.returning();
		return row;
	}

	async updateBody(id: string, body: string): Promise<void> {
		await this.db
			.update(issueActivity)
			.set({ body, editedAt: new Date() })
			.where(eq(issueActivity.id, id));
	}

	async delete(id: string): Promise<void> {
		await this.db.delete(issueActivity).where(eq(issueActivity.id, id));
	}
}
