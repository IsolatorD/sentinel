import { Inject, Injectable } from "@nestjs/common";
import {
	alertChannel,
	alertDelivery,
	alertRule,
	alertRuleChannel,
	and,
	count,
	type Database,
	desc,
	eq,
	inArray,
	member,
	organization,
	project,
} from "@sentinel/db";
import { DB } from "../database/database.module.js";

export type ChannelRow = typeof alertChannel.$inferSelect;
export type RuleRow = typeof alertRule.$inferSelect & { channelIds: string[] };
export type DeliveryRow = typeof alertDelivery.$inferSelect;

export type NewChannel = Pick<
	typeof alertChannel.$inferInsert,
	"projectId" | "type" | "name" | "config"
>;
export type RuleValues = Omit<
	typeof alertRule.$inferInsert,
	"id" | "projectId" | "createdAt" | "updatedAt"
>;

// Única capa que conoce Drizzle para las alertas.
@Injectable()
export class AlertsRepository {
	constructor(@Inject(DB) private readonly db: Database) {}

	// ---------- Canales ----------

	listChannels(projectId: string): Promise<ChannelRow[]> {
		return this.db
			.select()
			.from(alertChannel)
			.where(eq(alertChannel.projectId, projectId))
			.orderBy(alertChannel.createdAt);
	}

	async findChannel(
		projectId: string,
		id: string,
	): Promise<ChannelRow | undefined> {
		const [row] = await this.db
			.select()
			.from(alertChannel)
			.where(
				and(eq(alertChannel.projectId, projectId), eq(alertChannel.id, id)),
			);
		return row;
	}

	/** Cuántos de estos canales pertenecen al proyecto. */
	async countChannelsInProject(
		projectId: string,
		ids: string[],
	): Promise<number> {
		if (ids.length === 0) return 0;
		const [row] = await this.db
			.select({ n: count() })
			.from(alertChannel)
			.where(
				and(
					eq(alertChannel.projectId, projectId),
					inArray(alertChannel.id, ids),
				),
			);
		return row?.n ?? 0;
	}

	async createChannel(values: NewChannel): Promise<ChannelRow> {
		const [row] = await this.db.insert(alertChannel).values(values).returning();
		return row;
	}

	async updateChannel(
		projectId: string,
		id: string,
		values: Partial<Pick<ChannelRow, "name" | "enabled" | "config">>,
	): Promise<ChannelRow | undefined> {
		const [row] = await this.db
			.update(alertChannel)
			.set({ ...values, updatedAt: new Date() })
			.where(
				and(eq(alertChannel.projectId, projectId), eq(alertChannel.id, id)),
			)
			.returning();
		return row;
	}

	async deleteChannel(projectId: string, id: string): Promise<boolean> {
		const rows = await this.db
			.delete(alertChannel)
			.where(
				and(eq(alertChannel.projectId, projectId), eq(alertChannel.id, id)),
			)
			.returning({ id: alertChannel.id });
		return rows.length > 0;
	}

	// ---------- Reglas ----------

	async listRules(projectId: string): Promise<RuleRow[]> {
		const rules = await this.db
			.select()
			.from(alertRule)
			.where(eq(alertRule.projectId, projectId))
			.orderBy(alertRule.createdAt);
		return this.withChannels(rules);
	}

	async findRule(projectId: string, id: string): Promise<RuleRow | undefined> {
		const rules = await this.db
			.select()
			.from(alertRule)
			.where(and(eq(alertRule.projectId, projectId), eq(alertRule.id, id)));
		return (await this.withChannels(rules))[0];
	}

	private async withChannels(
		rules: Array<typeof alertRule.$inferSelect>,
	): Promise<RuleRow[]> {
		if (rules.length === 0) return [];
		const links = await this.db
			.select()
			.from(alertRuleChannel)
			.where(
				inArray(
					alertRuleChannel.ruleId,
					rules.map((r) => r.id),
				),
			);
		return rules.map((r) => ({
			...r,
			channelIds: links
				.filter((l) => l.ruleId === r.id)
				.map((l) => l.channelId),
		}));
	}

	async createRule(
		projectId: string,
		values: RuleValues,
		channelIds: string[],
	): Promise<RuleRow> {
		return this.db.transaction(async (tx) => {
			const [rule] = await tx
				.insert(alertRule)
				.values({ ...values, projectId })
				.returning();
			await tx
				.insert(alertRuleChannel)
				.values(
					channelIds.map((channelId) => ({ ruleId: rule.id, channelId })),
				);
			return { ...rule, channelIds };
		});
	}

	async updateRule(
		projectId: string,
		id: string,
		values: Partial<RuleValues>,
		channelIds?: string[],
	): Promise<RuleRow | undefined> {
		return this.db.transaction(async (tx) => {
			const [rule] = await tx
				.update(alertRule)
				.set({ ...values, updatedAt: new Date() })
				.where(and(eq(alertRule.projectId, projectId), eq(alertRule.id, id)))
				.returning();
			if (!rule) return undefined;
			if (channelIds) {
				await tx
					.delete(alertRuleChannel)
					.where(eq(alertRuleChannel.ruleId, id));
				await tx
					.insert(alertRuleChannel)
					.values(channelIds.map((channelId) => ({ ruleId: id, channelId })));
			}
			const links = await tx
				.select()
				.from(alertRuleChannel)
				.where(eq(alertRuleChannel.ruleId, id));
			return { ...rule, channelIds: links.map((l) => l.channelId) };
		});
	}

	async deleteRule(projectId: string, id: string): Promise<boolean> {
		const rows = await this.db
			.delete(alertRule)
			.where(and(eq(alertRule.projectId, projectId), eq(alertRule.id, id)))
			.returning({ id: alertRule.id });
		return rows.length > 0;
	}

	// ---------- Envíos ----------

	async listDeliveries(
		projectId: string,
		limit: number,
		offset: number,
	): Promise<{ rows: DeliveryRow[]; total: number }> {
		const where = eq(alertDelivery.projectId, projectId);
		const [rows, [totalRow]] = await Promise.all([
			this.db
				.select()
				.from(alertDelivery)
				.where(where)
				.orderBy(desc(alertDelivery.createdAt))
				.limit(limit)
				.offset(offset),
			this.db.select({ n: count() }).from(alertDelivery).where(where),
		]);
		return { rows, total: totalRow?.n ?? 0 };
	}

	async createDelivery(
		values: typeof alertDelivery.$inferInsert,
	): Promise<DeliveryRow> {
		const [row] = await this.db
			.insert(alertDelivery)
			.values(values)
			.returning();
		return row;
	}

	// ---------- Contexto ----------

	/** Proyecto con su organización (para armar el aviso de prueba). */
	async projectContext(projectId: string) {
		const [row] = await this.db
			.select({
				project: { id: project.id, name: project.name, slug: project.slug },
				organization: {
					id: organization.id,
					name: organization.name,
					slug: organization.slug,
				},
			})
			.from(project)
			.innerJoin(organization, eq(organization.id, project.organizationId))
			.where(eq(project.id, projectId));
		return row;
	}

	/** Cuáles de estos usuarios son miembros de la organización. */
	async memberUserIds(
		organizationId: string,
		userIds: string[],
	): Promise<Set<string>> {
		if (userIds.length === 0) return new Set();
		const rows = await this.db
			.select({ userId: member.userId })
			.from(member)
			.where(
				and(
					eq(member.organizationId, organizationId),
					inArray(member.userId, userIds),
				),
			);
		return new Set(rows.map((r) => r.userId));
	}
}
