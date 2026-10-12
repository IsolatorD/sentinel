import { randomBytes } from "node:crypto";
import { InjectQueue } from "@nestjs/bullmq";
import {
	BadRequestException,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
	type AlertPayload,
	type ChannelDto,
	type ChannelType,
	type CreateChannelInput,
	type CreatedChannelDto,
	type CreateRuleInput,
	type DeliveryDto,
	type DeliveryListDto,
	type EmailRecipients,
	emailRecipientsSchema,
	isBlockedHostname,
	isPerformanceTrigger,
	type ListDeliveriesQuery,
	NOTIFICATIONS_QUEUE,
	type NotificationJobData,
	type RuleDto,
	ruleShapeProblem,
	type UpdateChannelInput,
	type UpdateRuleInput,
} from "@sentinel/shared";
import type { Queue } from "bullmq";
import type { ApiEnv } from "../config/env.js";
import { OrgAccessService } from "../organizations/org-access.service.js";
import { ProjectsService } from "../projects/projects.service.js";
import {
	AlertsRepository,
	type ChannelRow,
	type DeliveryRow,
	type RuleRow,
} from "./alerts.repository.js";
import { maskUrl } from "./domain/mask-url.js";

const toChannelDto = (row: ChannelRow): ChannelDto => {
	const config = row.config as { url?: string; recipients?: EmailRecipients };
	return {
		id: row.id,
		projectId: row.projectId,
		type: row.type as ChannelType,
		name: row.name,
		enabled: row.enabled,
		maskedUrl: config.url ? maskUrl(config.url) : null,
		recipients: config.recipients ?? null,
		createdAt: row.createdAt.toISOString(),
	};
};

const toRuleDto = (row: RuleRow): RuleDto => ({
	id: row.id,
	projectId: row.projectId,
	name: row.name,
	trigger: row.trigger as RuleDto["trigger"],
	threshold: row.threshold,
	windowMinutes: row.windowMinutes,
	cooldownMinutes: row.cooldownMinutes,
	environment: row.environment,
	minLevel: row.minLevel as RuleDto["minLevel"],
	transactionName: row.transactionName,
	channelIds: row.channelIds,
	enabled: row.enabled,
	createdAt: row.createdAt.toISOString(),
	updatedAt: row.updatedAt.toISOString(),
});

const toDeliveryDto = (row: DeliveryRow): DeliveryDto => ({
	id: row.id,
	kind: row.kind as DeliveryDto["kind"],
	status: row.status as DeliveryDto["status"],
	ruleId: row.ruleId,
	ruleName: row.ruleName,
	channelId: row.channelId,
	channelName: row.channelName,
	channelType: row.channelType as ChannelType,
	issueId: row.issueId,
	issueTitle: row.issueTitle,
	attempts: row.attempts,
	error: row.error,
	statusCode: row.statusCode,
	createdAt: row.createdAt.toISOString(),
	sentAt: row.sentAt ? row.sentAt.toISOString() : null,
});

@Injectable()
export class AlertsService {
	private readonly allowPrivate: boolean;
	private readonly webOrigin: string;

	constructor(
		private readonly repository: AlertsRepository,
		private readonly access: OrgAccessService,
		private readonly projects: ProjectsService,
		@InjectQueue(NOTIFICATIONS_QUEUE)
		private readonly queue: Queue<NotificationJobData>,
		config: ConfigService<ApiEnv, true>,
	) {
		this.allowPrivate = config.get("ALLOW_PRIVATE_WEBHOOKS", { infer: true });
		this.webOrigin = config
			.get("WEB_ORIGIN", { infer: true })
			.replace(/\/$/, "");
	}

	// ---------- Canales ----------

	async listChannels(
		userId: string,
		orgId: string,
		projectId: string,
	): Promise<ChannelDto[]> {
		await this.authorize(userId, orgId, projectId, "member");
		return (await this.repository.listChannels(projectId)).map(toChannelDto);
	}

	async createChannel(
		userId: string,
		orgId: string,
		projectId: string,
		input: CreateChannelInput,
	): Promise<CreatedChannelDto> {
		await this.authorize(userId, orgId, projectId, "admin");

		let config: Record<string, unknown>;
		let signingSecret: string | null = null;
		if (input.type === "email") {
			await this.assertMembers(orgId, input.recipients);
			config = { recipients: input.recipients };
		} else if (input.type === "webhook") {
			this.assertUrlAllowed(input.url);
			signingSecret = `whsec_${randomBytes(24).toString("hex")}`;
			config = { url: input.url, secret: signingSecret };
		} else {
			this.assertUrlAllowed(input.url);
			config = { url: input.url };
		}

		const row = await this.repository.createChannel({
			projectId,
			type: input.type,
			name: input.name,
			config,
		});
		return { ...toChannelDto(row), signingSecret };
	}

	async updateChannel(
		userId: string,
		orgId: string,
		projectId: string,
		channelId: string,
		input: UpdateChannelInput,
	): Promise<ChannelDto> {
		await this.authorize(userId, orgId, projectId, "admin");
		const channel = await this.requireChannel(projectId, channelId);

		const config = { ...channel.config } as Record<string, unknown>;
		if (input.url !== undefined) {
			if (channel.type === "email")
				throw new BadRequestException({ reason: "EMAIL_CHANNEL_NO_URL" });
			this.assertUrlAllowed(input.url);
			config.url = input.url;
		}
		if (input.recipients !== undefined) {
			if (channel.type !== "email")
				throw new BadRequestException({ reason: "ONLY_EMAIL_HAS_RECIPIENTS" });
			await this.assertMembers(orgId, input.recipients);
			config.recipients = input.recipients;
		}
		const row = await this.repository.updateChannel(projectId, channelId, {
			...(input.name !== undefined && { name: input.name }),
			...(input.enabled !== undefined && { enabled: input.enabled }),
			config,
		});
		if (!row) throw new NotFoundException({ reason: "CHANNEL_NOT_FOUND" });
		return toChannelDto(row);
	}

	async deleteChannel(
		userId: string,
		orgId: string,
		projectId: string,
		channelId: string,
	): Promise<void> {
		await this.authorize(userId, orgId, projectId, "admin");
		if (!(await this.repository.deleteChannel(projectId, channelId)))
			throw new NotFoundException({ reason: "CHANNEL_NOT_FOUND" });
	}

	/** Envía un aviso de ejemplo por el canal para comprobar que llega. Queda en el historial. */
	async testChannel(
		userId: string,
		orgId: string,
		projectId: string,
		channelId: string,
	): Promise<DeliveryDto> {
		await this.authorize(userId, orgId, projectId, "admin");
		const channel = await this.requireChannel(projectId, channelId);
		const context = await this.repository.projectContext(projectId);
		if (!context) throw new NotFoundException({ reason: "PROJECT_NOT_FOUND" });

		const now = new Date().toISOString();
		const payload: AlertPayload = {
			kind: "test",
			trigger: "new_issue",
			ruleName: "Test alert",
			organization: context.organization,
			project: context.project,
			issue: {
				id: "00000000-0000-4000-8000-000000000000",
				title:
					"TypeError: Cannot read properties of undefined (reading 'total')",
				culprit: "computeTotal (cart.ts:42)",
				type: "TypeError",
				level: "error",
				eventCount: 1,
				firstSeen: now,
				lastSeen: now,
				environment: "production",
				release: "1.0.0",
				regressedInRelease: null,
			},
			url: `${this.webOrigin}/${context.organization.slug}/projects/${context.project.slug}/issues`,
		};
		const row = await this.repository.createDelivery({
			projectId,
			kind: "test",
			channelId: channel.id,
			channelName: channel.name,
			channelType: channel.type,
			payload: payload as unknown as Record<string, unknown>,
		});
		await this.queue.add(
			"notify",
			{ deliveryId: row.id },
			{
				jobId: row.id,
				attempts: 1,
				removeOnComplete: { age: 3_600 },
				removeOnFail: { age: 86_400 },
			},
		);
		return toDeliveryDto(row);
	}

	// ---------- Reglas ----------

	async listRules(
		userId: string,
		orgId: string,
		projectId: string,
	): Promise<RuleDto[]> {
		await this.authorize(userId, orgId, projectId, "member");
		return (await this.repository.listRules(projectId)).map(toRuleDto);
	}

	async createRule(
		userId: string,
		orgId: string,
		projectId: string,
		input: CreateRuleInput,
	): Promise<RuleDto> {
		await this.authorize(userId, orgId, projectId, "admin");
		await this.assertChannels(projectId, input.channelIds);
		const { channelIds, ...values } = input;
		const row = await this.repository.createRule(
			projectId,
			{
				name: values.name,
				trigger: values.trigger,
				threshold: values.threshold ?? null,
				windowMinutes: values.windowMinutes ?? null,
				cooldownMinutes: values.cooldownMinutes,
				environment: values.environment ?? null,
				minLevel: values.minLevel ?? null,
				transactionName: values.transactionName ?? null,
				enabled: values.enabled,
			},
			[...new Set(channelIds)],
		);
		return toRuleDto(row);
	}

	async updateRule(
		userId: string,
		orgId: string,
		projectId: string,
		ruleId: string,
		input: UpdateRuleInput,
	): Promise<RuleDto> {
		await this.authorize(userId, orgId, projectId, "admin");
		const current = await this.repository.findRule(projectId, ruleId);
		if (!current) throw new NotFoundException({ reason: "RULE_NOT_FOUND" });

		// El resultado debe seguir siendo una regla válida: se mira lo guardado mezclado con lo nuevo
		// (p. ej. frecuencia exige umbral y ventana; cambiar a "issue nuevo" los quita).
		const trigger = input.trigger ?? (current.trigger as RuleDto["trigger"]);
		const usesThreshold =
			trigger === "frequency" || isPerformanceTrigger(trigger);
		const merged = {
			trigger,
			threshold: usesThreshold
				? input.threshold === undefined
					? current.threshold
					: input.threshold
				: null,
			windowMinutes: usesThreshold
				? input.windowMinutes === undefined
					? current.windowMinutes
					: input.windowMinutes
				: null,
			minLevel: isPerformanceTrigger(trigger)
				? null
				: input.minLevel === undefined
					? current.minLevel
					: input.minLevel,
			transactionName: isPerformanceTrigger(trigger)
				? input.transactionName === undefined
					? current.transactionName
					: input.transactionName
				: null,
		};
		// Lo que el cliente envió explícitamente y no encaja con el tipo de regla se rechaza,
		// en vez de descartarlo en silencio.
		const problem = ruleShapeProblem({
			trigger,
			threshold: usesThreshold ? merged.threshold : input.threshold,
			windowMinutes: usesThreshold ? merged.windowMinutes : input.windowMinutes,
			minLevel: isPerformanceTrigger(trigger)
				? input.minLevel
				: merged.minLevel,
			transactionName: isPerformanceTrigger(trigger)
				? merged.transactionName
				: input.transactionName,
		});
		if (problem)
			throw new BadRequestException({
				reason:
					trigger === "frequency" ? "FREQUENCY_NEEDS_THRESHOLD" : problem.code,
			});
		if (input.channelIds)
			await this.assertChannels(projectId, input.channelIds);

		const row = await this.repository.updateRule(
			projectId,
			ruleId,
			{
				...(input.name !== undefined && { name: input.name }),
				...(input.enabled !== undefined && { enabled: input.enabled }),
				...(input.cooldownMinutes !== undefined && {
					cooldownMinutes: input.cooldownMinutes,
				}),
				...(input.environment !== undefined && {
					environment: input.environment,
				}),
				trigger,
				threshold: merged.threshold,
				windowMinutes: merged.windowMinutes,
				minLevel: merged.minLevel,
				transactionName: merged.transactionName,
			},
			input.channelIds ? [...new Set(input.channelIds)] : undefined,
		);
		if (!row) throw new NotFoundException({ reason: "RULE_NOT_FOUND" });
		return toRuleDto(row);
	}

	async deleteRule(
		userId: string,
		orgId: string,
		projectId: string,
		ruleId: string,
	): Promise<void> {
		await this.authorize(userId, orgId, projectId, "admin");
		if (!(await this.repository.deleteRule(projectId, ruleId)))
			throw new NotFoundException({ reason: "RULE_NOT_FOUND" });
	}

	// ---------- Envíos ----------

	async listDeliveries(
		userId: string,
		orgId: string,
		projectId: string,
		query: ListDeliveriesQuery,
	): Promise<DeliveryListDto> {
		await this.authorize(userId, orgId, projectId, "member");
		const { rows, total } = await this.repository.listDeliveries(
			projectId,
			query.limit,
			query.offset,
		);
		return {
			items: rows.map(toDeliveryDto),
			total,
			limit: query.limit,
			offset: query.offset,
		};
	}

	// ---------- Helpers ----------

	private async authorize(
		userId: string,
		orgId: string,
		projectId: string,
		level: "member" | "admin",
	): Promise<void> {
		await this.access.assert(userId, orgId, level);
		await this.projects.ensureExists(orgId, projectId);
	}

	private async requireChannel(
		projectId: string,
		channelId: string,
	): Promise<ChannelRow> {
		const channel = await this.repository.findChannel(projectId, channelId);
		if (!channel) throw new NotFoundException({ reason: "CHANNEL_NOT_FOUND" });
		return channel;
	}

	/** El host de un webhook no puede ser interno, salvo que el servidor lo permita expresamente. */
	private assertUrlAllowed(url: string): void {
		if (!this.allowPrivate && isBlockedHostname(new URL(url).hostname)) {
			throw new BadRequestException({ reason: "URL_NOT_ALLOWED" });
		}
	}

	private async assertMembers(
		orgId: string,
		recipients: EmailRecipients,
	): Promise<void> {
		const parsed = emailRecipientsSchema.parse(recipients);
		if (parsed.mode === "all") return;
		const found = await this.repository.memberUserIds(orgId, parsed.userIds);
		if (parsed.userIds.some((id) => !found.has(id)))
			throw new BadRequestException({ reason: "RECIPIENTS_NOT_MEMBERS" });
	}

	private async assertChannels(
		projectId: string,
		channelIds: string[],
	): Promise<void> {
		const unique = [...new Set(channelIds)];
		if (
			(await this.repository.countChannelsInProject(projectId, unique)) !==
			unique.length
		)
			throw new BadRequestException({ reason: "CHANNELS_NOT_IN_PROJECT" });
	}
}
