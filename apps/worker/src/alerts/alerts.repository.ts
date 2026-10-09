import { Inject, Injectable } from "@nestjs/common";
import {
	alertChannel,
	alertDelivery,
	alertRule,
	alertRuleChannel,
	and,
	count,
	type Database,
	eq,
	event,
	gte,
	inArray,
	issue,
	member,
	organization,
	project,
	user,
	userPreference,
} from "@sentinel/db";
import {
	type AlertPayload,
	type AlertTrigger,
	type ChannelType,
	DEFAULT_LOCALE,
	type EmailRecipients,
	isLocale,
	type Locale,
} from "@sentinel/shared";
import { DB } from "../database/database.module.js";
import type { RuleCriteria } from "./domain/rule-matching.js";

export interface RuleRecord extends RuleCriteria {
	id: string;
	name: string;
	cooldownMinutes: number;
	channelIds: string[];
}

export interface ChannelRecord {
	id: string;
	projectId: string;
	type: ChannelType;
	name: string;
	enabled: boolean;
	config: Record<string, unknown>;
}

export interface NewDelivery {
	projectId: string;
	kind: "alert" | "test";
	ruleId: string | null;
	ruleName: string | null;
	channelId: string;
	channelName: string;
	channelType: ChannelType;
	issueId: string;
	issueTitle: string;
	payload: AlertPayload;
}

export interface DeliveryRecord {
	id: string;
	status: string;
	kind: "alert" | "test";
	channelId: string | null;
	payload: AlertPayload;
}

/** Contexto del issue para armar el aviso: el issue, su proyecto y su organización. */
export interface IssueContext {
	issue: typeof issue.$inferSelect;
	project: { id: string; name: string; slug: string };
	organization: { id: string; name: string; slug: string };
}

@Injectable()
export class AlertsRepository {
	constructor(@Inject(DB) private readonly db: Database) {}

	/** Reglas activas del proyecto, con los canales activos a los que avisan. */
	async activeRules(projectId: string): Promise<RuleRecord[]> {
		const rules = await this.db
			.select()
			.from(alertRule)
			.where(
				and(eq(alertRule.projectId, projectId), eq(alertRule.enabled, true)),
			);
		if (rules.length === 0) return [];
		const links = await this.db
			.select({
				ruleId: alertRuleChannel.ruleId,
				channelId: alertRuleChannel.channelId,
			})
			.from(alertRuleChannel)
			.innerJoin(alertChannel, eq(alertChannel.id, alertRuleChannel.channelId))
			.where(
				and(
					inArray(
						alertRuleChannel.ruleId,
						rules.map((r) => r.id),
					),
					eq(alertChannel.enabled, true),
				),
			);
		return rules.map((r) => ({
			id: r.id,
			name: r.name,
			trigger: r.trigger as AlertTrigger,
			threshold: r.threshold,
			windowMinutes: r.windowMinutes,
			cooldownMinutes: r.cooldownMinutes,
			environment: r.environment,
			minLevel: r.minLevel,
			channelIds: links
				.filter((l) => l.ruleId === r.id)
				.map((l) => l.channelId),
		}));
	}

	async countRecentEvents(issueId: string, since: Date): Promise<number> {
		const [row] = await this.db
			.select({ n: count() })
			.from(event)
			.where(and(eq(event.issueId, issueId), gte(event.receivedAt, since)));
		return row?.n ?? 0;
	}

	async issueContext(issueId: string): Promise<IssueContext | undefined> {
		const [row] = await this.db
			.select({
				issue,
				project: { id: project.id, name: project.name, slug: project.slug },
				organization: {
					id: organization.id,
					name: organization.name,
					slug: organization.slug,
				},
			})
			.from(issue)
			.innerJoin(project, eq(project.id, issue.projectId))
			.innerJoin(organization, eq(organization.id, project.organizationId))
			.where(eq(issue.id, issueId));
		return row;
	}

	async channelsByIds(ids: string[]): Promise<ChannelRecord[]> {
		if (ids.length === 0) return [];
		const rows = await this.db
			.select()
			.from(alertChannel)
			.where(
				and(inArray(alertChannel.id, ids), eq(alertChannel.enabled, true)),
			);
		return rows.map(toChannelRecord);
	}

	async findChannel(id: string): Promise<ChannelRecord | undefined> {
		const [row] = await this.db
			.select()
			.from(alertChannel)
			.where(eq(alertChannel.id, id));
		return row ? toChannelRecord(row) : undefined;
	}

	async createDeliveries(rows: NewDelivery[]): Promise<string[]> {
		if (rows.length === 0) return [];
		const inserted = await this.db
			.insert(alertDelivery)
			.values(
				rows.map((r) => ({
					...r,
					payload: r.payload as unknown as Record<string, unknown>,
				})),
			)
			.returning({ id: alertDelivery.id });
		return inserted.map((r) => r.id);
	}

	async findDelivery(id: string): Promise<DeliveryRecord | undefined> {
		const [row] = await this.db
			.select()
			.from(alertDelivery)
			.where(eq(alertDelivery.id, id));
		return row
			? {
					id: row.id,
					status: row.status,
					kind: row.kind as "alert" | "test",
					channelId: row.channelId,
					payload: row.payload as unknown as AlertPayload,
				}
			: undefined;
	}

	async markSent(
		id: string,
		attempts: number,
		statusCode?: number,
	): Promise<void> {
		await this.db
			.update(alertDelivery)
			.set({
				status: "sent",
				attempts,
				statusCode: statusCode ?? null,
				error: null,
				sentAt: new Date(),
			})
			.where(eq(alertDelivery.id, id));
	}

	/** Registra un intento fallido; `final` lo deja como fallido, si no sigue pendiente de reintento. */
	async markFailure(
		id: string,
		attempts: number,
		error: string,
		final: boolean,
		statusCode?: number,
	): Promise<void> {
		await this.db
			.update(alertDelivery)
			.set({
				status: final ? "failed" : "pending",
				attempts,
				error: error.slice(0, 500),
				statusCode: statusCode ?? null,
			})
			.where(eq(alertDelivery.id, id));
	}

	/** Correo e idioma de los miembros de la organización (todos, o solo los indicados). */
	async memberRecipients(
		organizationId: string,
		recipients: EmailRecipients,
	): Promise<Array<{ email: string; locale: Locale }>> {
		const where =
			recipients.mode === "members"
				? and(
						eq(member.organizationId, organizationId),
						inArray(member.userId, recipients.userIds),
					)
				: eq(member.organizationId, organizationId);
		const rows = await this.db
			.select({ email: user.email, locale: userPreference.locale })
			.from(member)
			.innerJoin(user, eq(user.id, member.userId))
			.leftJoin(userPreference, eq(userPreference.userId, user.id))
			.where(where);
		const byEmail = new Map<string, Locale>();
		for (const row of rows)
			byEmail.set(
				row.email,
				isLocale(row.locale) ? row.locale : DEFAULT_LOCALE,
			);
		return [...byEmail].map(([email, locale]) => ({ email, locale }));
	}
}

function toChannelRecord(row: typeof alertChannel.$inferSelect): ChannelRecord {
	return {
		id: row.id,
		projectId: row.projectId,
		type: row.type as ChannelType,
		name: row.name,
		enabled: row.enabled,
		config: row.config,
	};
}
