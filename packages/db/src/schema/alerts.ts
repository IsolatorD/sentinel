import {
	boolean,
	index,
	integer,
	jsonb,
	pgTable,
	primaryKey,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { issue } from "./events.js";
import { project } from "./projects.js";

/** Dónde se envían los avisos de un proyecto: email, webhook genérico o Slack. */
export const alertChannel = pgTable(
	"alert_channel",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		projectId: uuid("project_id")
			.notNull()
			.references(() => project.id, { onDelete: "cascade" }),
		type: text("type").notNull(), // email | webhook | slack
		name: text("name").notNull(),
		enabled: boolean("enabled").notNull().default(true),
		// email: { recipients: { mode: "all" | "members", userIds?: string[] } }
		// webhook: { url, secret }   slack: { url }
		config: jsonb("config").$type<Record<string, unknown>>().notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(t) => [index("alert_channel_project_idx").on(t.projectId)],
);

/** Cuándo avisar: nuevo issue, regresión o un umbral de frecuencia, con filtros opcionales. */
export const alertRule = pgTable(
	"alert_rule",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		projectId: uuid("project_id")
			.notNull()
			.references(() => project.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		// new_issue | regression | frequency | p95_above | error_rate_above
		trigger: text("trigger").notNull(),
		threshold: integer("threshold"),
		windowMinutes: integer("window_minutes"),
		cooldownMinutes: integer("cooldown_minutes").notNull().default(60),
		environment: text("environment"),
		minLevel: text("min_level"),
		// Reglas de rendimiento: una transacción concreta (null = todas las del proyecto).
		transactionName: text("transaction_name"),
		enabled: boolean("enabled").notNull().default(true),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(t) => [index("alert_rule_project_idx").on(t.projectId)],
);

export const alertRuleChannel = pgTable(
	"alert_rule_channel",
	{
		ruleId: uuid("rule_id")
			.notNull()
			.references(() => alertRule.id, { onDelete: "cascade" }),
		channelId: uuid("channel_id")
			.notNull()
			.references(() => alertChannel.id, { onDelete: "cascade" }),
	},
	(t) => [
		primaryKey({ columns: [t.ruleId, t.channelId] }),
		index("alert_rule_channel_channel_idx").on(t.channelId),
	],
);

/**
 * Un aviso concreto a un canal: su estado, intentos y el contenido enviado. El nombre de la regla
 * y del canal se copian para que el historial se entienda aunque se borren después.
 */
export const alertDelivery = pgTable(
	"alert_delivery",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		projectId: uuid("project_id")
			.notNull()
			.references(() => project.id, { onDelete: "cascade" }),
		kind: text("kind").notNull().default("alert"), // alert | test
		status: text("status").notNull().default("pending"), // pending | sent | failed
		ruleId: uuid("rule_id").references(() => alertRule.id, {
			onDelete: "set null",
		}),
		ruleName: text("rule_name"),
		channelId: uuid("channel_id").references(() => alertChannel.id, {
			onDelete: "set null",
		}),
		channelName: text("channel_name").notNull(),
		channelType: text("channel_type").notNull(),
		issueId: uuid("issue_id").references(() => issue.id, {
			onDelete: "set null",
		}),
		issueTitle: text("issue_title"),
		attempts: integer("attempts").notNull().default(0),
		error: text("error"),
		statusCode: integer("status_code"),
		payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		sentAt: timestamp("sent_at"),
	},
	(t) => [
		index("alert_delivery_project_created_idx").on(t.projectId, t.createdAt),
	],
);
