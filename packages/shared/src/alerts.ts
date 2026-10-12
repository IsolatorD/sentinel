import { z } from "zod";
import { checkWebhookUrl } from "./network.js";

export const NOTIFICATIONS_QUEUE = "notifications";
/** Cola de la evaluación periódica de las reglas de rendimiento. */
export const PERFORMANCE_ALERTS_QUEUE = "performance-alerts";
export const PERFORMANCE_ALERTS_JOB = "evaluate";

export const ISSUE_TRIGGERS = ["new_issue", "regression", "frequency"] as const;
/** Reglas de rendimiento: p95 de la duración y tasa de errores de las transacciones. */
export const PERFORMANCE_TRIGGERS = ["p95_above", "error_rate_above"] as const;
export const ALERT_TRIGGERS = [
	...ISSUE_TRIGGERS,
	...PERFORMANCE_TRIGGERS,
] as const;
export const alertTriggerSchema = z.enum(ALERT_TRIGGERS);
export type AlertTrigger = z.infer<typeof alertTriggerSchema>;
export type IssueTrigger = (typeof ISSUE_TRIGGERS)[number];
export type PerformanceTrigger = (typeof PERFORMANCE_TRIGGERS)[number];

export const isPerformanceTrigger = (
	trigger: string,
): trigger is PerformanceTrigger =>
	(PERFORMANCE_TRIGGERS as readonly string[]).includes(trigger);

/** Con menos transacciones en la ventana no se avisa: un p95 de tres muestras no significa nada. */
export const PERFORMANCE_MIN_SAMPLES = 10;
/** Ventana mínima de una regla de rendimiento (minutos). */
export const PERFORMANCE_MIN_WINDOW_MINUTES = 5;
/** Techo del umbral de latencia (una hora, en milisegundos). */
export const MAX_P95_THRESHOLD_MS = 3_600_000;

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
		if (!check.ok) ctx.addIssue({ code: "custom", message: check.code });
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
	.refine((v) => Object.keys(v).length > 0, "NOTHING_TO_UPDATE");
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
	threshold: z.number().int().min(1).max(MAX_P95_THRESHOLD_MS).optional(),
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
	/** Reglas de rendimiento: solo esta transacción (si no, todas las del proyecto). */
	transactionName: z.string().trim().min(1).max(2048).optional(),
	channelIds: z.array(z.string().uuid()).min(1).max(20),
	enabled: z.boolean().default(true),
};

export interface RuleShape {
	trigger: AlertTrigger;
	threshold?: number | null;
	windowMinutes?: number | null;
	minLevel?: string | null;
	transactionName?: string | null;
}

/**
 * Qué campos lleva cada tipo de regla. Devuelve el campo con problema y el código del mensaje, o
 * `null` si la regla es válida. Lo comparten la validación de la creación y la de la edición (donde
 * hay que mirar el resultado de mezclar lo guardado con lo nuevo).
 */
export function ruleShapeProblem(
	v: RuleShape,
): { path: keyof RuleShape; code: string } | null {
	const has = (x: unknown) => x !== undefined && x !== null;
	if (v.trigger === "frequency") {
		if (!has(v.threshold))
			return { path: "threshold", code: "FREQUENCY_FIELD_REQUIRED" };
		if (!has(v.windowMinutes))
			return { path: "windowMinutes", code: "FREQUENCY_FIELD_REQUIRED" };
	} else if (isPerformanceTrigger(v.trigger)) {
		if (!has(v.threshold))
			return { path: "threshold", code: "PERFORMANCE_FIELD_REQUIRED" };
		if (!has(v.windowMinutes))
			return { path: "windowMinutes", code: "PERFORMANCE_FIELD_REQUIRED" };
		if (v.windowMinutes && v.windowMinutes < PERFORMANCE_MIN_WINDOW_MINUTES)
			return { path: "windowMinutes", code: "PERFORMANCE_WINDOW_MIN" };
		if (v.trigger === "error_rate_above" && v.threshold && v.threshold > 100)
			return { path: "threshold", code: "ERROR_RATE_RANGE" };
		if (has(v.minLevel))
			return { path: "minLevel", code: "PERFORMANCE_NO_LEVEL" };
	} else {
		if (has(v.threshold) || has(v.windowMinutes))
			return { path: "threshold", code: "THRESHOLD_NOT_ALLOWED" };
	}
	if (has(v.transactionName) && !isPerformanceTrigger(v.trigger))
		return { path: "transactionName", code: "PERFORMANCE_ONLY_FIELD" };
	return null;
}

function ruleShape(v: Partial<RuleShape>, ctx: z.RefinementCtx): void {
	if (!v.trigger) return;
	const problem = ruleShapeProblem({ ...v, trigger: v.trigger });
	if (problem)
		ctx.addIssue({
			code: "custom",
			path: [problem.path],
			message: problem.code,
		});
}

export const createRuleSchema = z.object(ruleFields).superRefine(ruleShape);
export type CreateRuleInput = z.infer<typeof createRuleSchema>;

export const updateRuleSchema = z
	.object({
		name: ruleFields.name.optional(),
		trigger: ruleFields.trigger.optional(),
		threshold: z
			.number()
			.int()
			.min(1)
			.max(MAX_P95_THRESHOLD_MS)
			.nullable()
			.optional(),
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
		transactionName: ruleFields.transactionName.nullable().optional(),
		channelIds: ruleFields.channelIds.optional(),
		enabled: z.boolean().optional(),
	})
	.refine((v) => Object.keys(v).length > 0, "NOTHING_TO_UPDATE");
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
	transactionName: z.string().nullable(),
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
export interface IssueAlertPayload {
	kind: "alert" | "test";
	trigger: IssueTrigger;
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

/** Aviso de una regla de rendimiento: no hay un issue, sino una medida que cruzó el umbral. */
export interface PerformanceAlertPayload {
	kind: "performance";
	trigger: PerformanceTrigger;
	ruleName: string;
	organization: { id: string; name: string; slug: string };
	project: { id: string; name: string; slug: string };
	performance: {
		/** `null` = todas las transacciones del proyecto. */
		transaction: string | null;
		environment: string | null;
		/** p95 en milisegundos, o tasa de errores en porcentaje (0-100). */
		value: number;
		threshold: number;
		windowMinutes: number;
		/** Transacciones medidas en la ventana. */
		sampleCount: number;
	};
	/** Enlace a la pantalla de rendimiento. */
	url: string;
}

export type AlertPayload = IssueAlertPayload | PerformanceAlertPayload;

/** Datos del job de la cola `notifications`. */
export interface NotificationJobData {
	deliveryId: string;
}

export const ALERT_TRIGGER_EVENT: Record<AlertTrigger, string> = {
	new_issue: "issue.new",
	regression: "issue.regression",
	frequency: "issue.frequency",
	p95_above: "performance.p95",
	error_rate_above: "performance.error_rate",
};
