import {
	doublePrecision,
	index,
	jsonb,
	pgTable,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { project } from "./projects.js";

// Una unidad de trabajo medida (una carga de página, una petición atendida...). Los spans cuelgan de ella.
export const perfTransaction = pgTable(
	"perf_transaction",
	{
		id: uuid("id").primaryKey(),
		projectId: uuid("project_id")
			.notNull()
			.references(() => project.id, { onDelete: "cascade" }),
		traceId: text("trace_id").notNull(),
		spanId: text("span_id").notNull(),
		parentSpanId: text("parent_span_id"),
		name: text("name").notNull(),
		op: text("op").notNull(),
		status: text("status").notNull(),
		// Inicio de la transacción.
		timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
		receivedAt: timestamp("received_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		durationMs: doublePrecision("duration_ms").notNull(),
		release: text("release"),
		environment: text("environment"),
		platform: text("platform"),
		userIdentifier: text("user_identifier"),
		// { lcp: { value, unit }, ... }
		measurements: jsonb("measurements").notNull().default({}),
		tags: jsonb("tags").notNull().default({}),
	},
	(t) => [
		index("perf_transaction_project_timestamp_idx").on(
			t.projectId,
			t.timestamp,
		),
		index("perf_transaction_project_name_timestamp_idx").on(
			t.projectId,
			t.name,
			t.timestamp,
		),
		index("perf_transaction_trace_idx").on(t.traceId),
	],
);

export const perfSpan = pgTable(
	"perf_span",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		transactionId: uuid("transaction_id")
			.notNull()
			.references(() => perfTransaction.id, { onDelete: "cascade" }),
		spanId: text("span_id").notNull(),
		parentSpanId: text("parent_span_id"),
		op: text("op").notNull(),
		description: text("description"),
		startTimestamp: timestamp("start_timestamp", {
			withTimezone: true,
		}).notNull(),
		durationMs: doublePrecision("duration_ms").notNull(),
		status: text("status"),
		data: jsonb("data"),
	},
	(t) => [index("perf_span_transaction_idx").on(t.transactionId)],
);
