import { Inject, Injectable } from "@nestjs/common";
import { and, apiToken, type Database, desc, eq } from "@sentinel/db";
import { DB } from "../database/database.module.js";

export type ApiTokenRow = typeof apiToken.$inferSelect;

@Injectable()
export class TokensRepository {
	constructor(@Inject(DB) private readonly db: Database) {}

	list(organizationId: string): Promise<ApiTokenRow[]> {
		return this.db
			.select()
			.from(apiToken)
			.where(eq(apiToken.organizationId, organizationId))
			.orderBy(desc(apiToken.createdAt));
	}

	async insert(input: {
		organizationId: string;
		name: string;
		tokenHash: string;
		tokenPrefix: string;
		createdBy: string;
	}): Promise<ApiTokenRow> {
		const [row] = await this.db.insert(apiToken).values(input).returning();
		return row;
	}

	async delete(organizationId: string, id: string): Promise<boolean> {
		const rows = await this.db
			.delete(apiToken)
			.where(
				and(eq(apiToken.id, id), eq(apiToken.organizationId, organizationId)),
			)
			.returning({ id: apiToken.id });
		return rows.length > 0;
	}

	async findByHash(tokenHash: string): Promise<ApiTokenRow | undefined> {
		const [row] = await this.db
			.select()
			.from(apiToken)
			.where(eq(apiToken.tokenHash, tokenHash))
			.limit(1);
		return row;
	}

	async touch(id: string): Promise<void> {
		await this.db
			.update(apiToken)
			.set({ lastUsedAt: new Date() })
			.where(eq(apiToken.id, id));
	}
}
