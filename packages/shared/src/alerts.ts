import { z } from "zod";
import { checkWebhookUrl } from "./network.js";

export const NOTIFICATIONS_QUEUE = "notifications";

export const ALERT_TRIGGERS = ["new_issue", "regression", "frequency"] as const;
export const alertTriggerSchema = z.enum(ALERT_TRIGGERS);
export type AlertTrigger = z.infer<typeof alertTriggerSchema>;

export const CHANNEL_TYPES = ["email", "webhook", "slack"] as const;
export const channelTypeSchema = z.enum(CHANNEL_TYPES);
export type ChannelType = z.infer<typeof channelTypeSchema>;

/** Del menos al más grave: sirve para "avisar desde este nivel". */
export const ALERT_LEVELS = [
	"debug",
	"info",
	"warning",
	"error",
	"fatal",
] as const;
export const alertLevelSchema = z.enum(ALERT_LEVELS);
export type AlertLevel = z.infer<typeof alertLevelSchema>;

export const levelRank = (level: string): number => {
	const index = ALERT_LEVELS.indexOf(level as AlertLevel);
	return index === -1 ? 0 : index;
};

export const MAX_FREQUENCY_WINDOW_MINUTES = 24 * 60;

// ---------- Canales ----------

const channelName = z.string().trim().min(1).max(60);

const webhookUrl = z
	.string()
	.trim()
	.max(2_000)
	.superRefine((value, ctx) => {
		// Solo la forma: si el host es interno lo decide el servidor (depende de ALLOW_PRIVATE_WEBHOOKS).
		const check = checkWebhookUrl(value, { allowPrivate: true });
		if (!check.ok) ctx.addIssue({ code: "custom", message: check.reason });
	});

export const emailRecipientsSchema = z.discriminatedUnion("mode", [
	z.object({ mode: z.literal("all") }),
	z.object({
		mode: z.literal("members"),
		userIds: z.array(z.string().min(1)).min(1).max(50),
	}),
]);
export type EmailRecipients = z.infer<typeof emailRecipientsSchema>;

export const createChannelSchema = z.discriminatedUnion("type", [
	z.object({
		type: z.literal("email"),
		name: channelName,
		recipients: emailRecipientsSchema,
	}),
	z.object({ type: z.literal("webhook"), name: channelName, url: webhookUrl }),
	z.object({ type: z.literal("slack"), name: channelName, url: webhookUrl }),
]);
export type CreateChannelInput = z.infer<typeof createChannelSchema>;

export const updateChannelSchema = z
	.object({
		name: channelName.optional(),
		enabled: z.boolean().optional(),
		url: webhookUrl.optional(),
		recipients: emailRecipientsSchema.optional(),
	})
	.refine((v) => Object.keys(v).length > 0, "Nothing to update");
export type UpdateChannelInput = z.infer<typeof updateChannelSchema>;

export const channelDtoSchema = z.object({
	id: z.string().uuid(),
	projectId: z.string().uuid(),
	type: channelTypeSchema,
	name: z.string(),
	enabled: z.boolean(),
	/** webhook/slack: la URL con la parte secreta oculta. */
	maskedUrl: z.string().nullable(),
	/** email: a quién se avisa. */
	recipients: emailRecipientsSchema.nullable(),
	createdAt: z.string().datetime(),
});
export type ChannelDto = z.infer<typeof channelDtoSchema>;
export const channelListDtoSchema = z.array(channelDtoSchema);

/** Al crear un webhook se devuelve, una única vez, el secreto con el que se firman los envíos. */
export const createdChannelDtoSchema = channelDtoSchema.extend({
	signingSecret: z.string().nullable(),
});
export type CreatedChannelDto = z.infer<typeof createdChannelDtoSchema>;

// ---------- Reglas ----------

const ruleFields = {
	name: z.string().trim().min(1).max(80),
	trigger: alertTriggerSchema,
	/** `frequency`: eventos del mismo issue que disparan el aviso... */
	threshold: z.number().int().min(1).max(100_000).optional(),
	/** ...dentro de esta ventana, en minutos. */
	windowMinutes: z
		.number()
		.int()
		.min(1)
		.max(MAX_FREQUENCY_WINDOW_MINUTES)
		.optional(),
	/** Mínimo de minutos entre dos avisos de la misma regla por el mismo issue. */
	cooldownMinutes: z
		.number()
		.int()
		.min(0)
		.max(7 * 24 * 60)
		.default(60),
	environment: z.string().trim().min(1).max(64).optional(),
	minLevel: alertLevelSchema.optional(),
	channelIds: z.array(z.string().uuid()).min(1).max(20),
	enabled: z.boolean().default(true),
};

function frequencyRules(
	v: { trigger?: AlertTrigger; threshold?: number; windowMinutes?: number },
	ctx: z.RefinementCtx,
) {
	if (v.trigger === "frequency") {
		if (v.threshold === undefined)
			ctx.addIssue({
				code: "custom",
				path: ["threshold"],
				message: "Required for frequency rules",
			});
		if (v.windowMinutes === undefined)
			ctx.addIssue({
				code: "custom",
				path: ["windowMinutes"],
				message: "Required for frequency rules",
			});
	} else if (
		v.trigger &&
		(v.threshold !== undefined || v.windowMinutes !== undefined)
	) {
		ctx.addIssue({
			code: "custom",
			path: ["threshold"],
			message: "Only frequency rules take a threshold and a window",
		});
	}
}

export const createRuleSchema = z
	.object(ruleFields)
	.superRefine(frequencyRules);
export type CreateRuleInput = z.infer<typeof createRuleSchema>;

export const updateRuleSchema = z
	.object({
		name: ruleFields.name.optional(),
		trigger: ruleFields.trigger.optional(),
		threshold: z.number().int().min(1).max(100_000).nullable().optional(),
		windowMinutes: z
			.number()
			.int()
			.min(1)
			.max(MAX_FREQUENCY_WINDOW_MINUTES)
			.nullable()
			.optional(),
		cooldownMinutes: z
			.number()
			.int()
			.min(0)
			.max(7 * 24 * 60)
			.optional(),
		environment: z.string().trim().min(1).max(64).nullable().optional(),
		minLevel: alertLevelSchema.nullable().optional(),
		channelIds: ruleFields.channelIds.optional(),
		enabled: z.boolean().optional(),
	})
	.refine((v) => Object.keys(v).length > 0, "Nothing to update");
export type UpdateRuleInput = z.infer<typeof updateRuleSchema>;

export const ruleDtoSchema = z.object({
	id: z.string().uuid(),
	projectId: z.string().uuid(),
	name: z.string(),
	trigger: alertTriggerSchema,
	threshold: z.number().int().nullable(),
	windowMinutes: z.number().int().nullable(),
	cooldownMinutes: z.number().int(),
	environment: z.string().nullable(),
	minLevel: alertLevelSchema.nullable(),
	channelIds: z.array(z.string().uuid()),
	enabled: z.boolean(),
	createdAt: z.string().datetime(),
	updatedAt: z.string().datetime(),
});
export type RuleDto = z.infer<typeof ruleDtoSchema>;
export const ruleListDtoSchema = z.array(ruleDtoSchema);

// ---------- Envíos ----------

export const DELIVERY_STATUSES = ["pending", "sent", "failed"] as const;
export const deliveryStatusSchema = z.enum(DELIVERY_STATUSES);
export type DeliveryStatus = z.infer<typeof deliveryStatusSchema>;

export const deliveryDtoSchema = z.object({
	id: z.string().uuid(),
	kind: z.enum(["alert", "test"]),
	status: deliveryStatusSchema,
	ruleId: z.string().uuid().nullable(),
	ruleName: z.string().nullable(),
	channelId: z.string().uuid().nullable(),
	channelName: z.string(),
	channelType: channelTypeSchema,
	issueId: z.string().uuid().nullable(),
	issueTitle: z.string().nullable(),
	attempts: z.number().int(),
	error: z.string().nullable(),
	statusCode: z.number().int().nullable(),
	createdAt: z.string().datetime(),
	sentAt: z.string().datetime().nullable(),
});
export type DeliveryDto = z.infer<typeof deliveryDtoSchema>;

export const listDeliveriesQuerySchema = z.object({
	limit: z.coerce.number().int().min(1).max(100).default(25),
	offset: z.coerce.number().int().min(0).default(0),
});
export type ListDeliveriesQuery = z.infer<typeof listDeliveriesQuerySchema>;

export const deliveryListDtoSchema = z.object({
	items: z.array(deliveryDtoSchema),
	total: z.number().int(),
	limit: z.number().int(),
	offset: z.number().int(),
});
export type DeliveryListDto = z.infer<typeof deliveryListDtoSchema>;

// ---------- Contenido del aviso ----------

/** Lo que se envía por cualquier canal; se guarda con el envío para que sea reproducible. */
export interface AlertPayload {
	kind: "alert" | "test";
	trigger: AlertTrigger;
	ruleName: string;
	organization: { id: string; name: string; slug: string };
	project: { id: string; name: string; slug: string };
	issue: {
		id: string;
		title: string;
		culprit: string | null;
		type: string;
		level: string;
		eventCount: number;
		firstSeen: string;
		lastSeen: string;
		environment: string | null;
		release: string | null;
		regressedInRelease: string | null;
	};
	/** Solo en reglas de frecuencia. */
	frequency?: { count: number; windowMinutes: number };
	/** Enlace al issue en el panel. */
	url: string;
}

/** Datos del job de la cola `notifications`. */
export interface NotificationJobData {
	deliveryId: string;
}

export const ALERT_TRIGGER_EVENT: Record<AlertTrigger, string> = {
	new_issue: "issue.new",
	regression: "issue.regression",
	frequency: "issue.frequency",
};
