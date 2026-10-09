import {
	boolean,
	index,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth.js";
import { project } from "./projects.js";

// Un issue agrupa todos los eventos con el mismo fingerprint dentro de un proyecto.
export const issue = pgTable(
	"issue",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		projectId: uuid("project_id")
			.notNull()
			.references(() => project.id, { onDelete: "cascade" }),
		fingerprint: text("fingerprint").notNull(),
		title: text("title").notNull(),
		culprit: text("culprit"),
		type: text("type").notNull(),
		level: text("level").notNull().default("error"),
		status: text("status").notNull().default("unresolved"),
		// Miembro responsable del issue (null = sin asignar).
		assigneeId: text("assignee_id").references(() => user.id, {
			onDelete: "set null",
		}),
		eventCount: integer("event_count").notNull().default(0),
		// Releases en las que apareció por primera vez y por última vez.
		firstRelease: text("first_release"),
		lastRelease: text("last_release"),
		// Resolución ligada a una release: si es null, cualquier evento nuevo reabre el issue.
		// Con valor, solo reabre un evento de una release posterior (o igual, si es inclusiva).
		resolvedRelease: text("resolved_release"),
		resolvedInclusive: boolean("resolved_inclusive").notNull().default(false),
		// Se reabrió solo después de estar resuelto (regresión), y en qué release.
		regressedAt: timestamp("regressed_at", { withTimezone: true }),
		regressedInRelease: text("regressed_in_release"),
		firstSeen: timestamp("first_seen", { withTimezone: true }).notNull(),
		lastSeen: timestamp("last_seen", { withTimezone: true }).notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(t) => [
		uniqueIndex("issue_project_fingerprint_idx").on(t.projectId, t.fingerprint),
		index("issue_project_assignee_idx").on(t.projectId, t.assigneeId),
		index("issue_project_last_seen_idx").on(t.projectId, t.lastSeen),
		index("issue_project_status_last_seen_idx").on(
			t.projectId,
			t.status,
			t.lastSeen,
		),
	],
);

// Una ocurrencia individual de un error. `payload` guarda el evento validado completo.
export const event = pgTable(
	"event",
	{
		id: uuid("id").primaryKey(),
		projectId: uuid("project_id")
			.notNull()
			.references(() => project.id, { onDelete: "cascade" }),
		issueId: uuid("issue_id")
			.notNull()
			.references(() => issue.id, { onDelete: "cascade" }),
		timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
		receivedAt: timestamp("received_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		level: text("level").notNull(),
		type: text("type").notNull(),
		message: text("message"),
		release: text("release"),
		environment: text("environment"),
		platform: text("platform"),
		userIdentifier: text("user_identifier"),
		payload: jsonb("payload").notNull(),
	},
	(t) => [
		index("event_issue_timestamp_idx").on(t.issueId, t.timestamp),
		index("event_project_timestamp_idx").on(t.projectId, t.timestamp),
		// Filtros del listado de issues por entorno y release.
		index("event_issue_environment_idx").on(t.issueId, t.environment),
		index("event_issue_release_idx").on(t.issueId, t.release),
		index("event_project_environment_idx").on(t.projectId, t.environment),
		index("event_project_release_idx").on(t.projectId, t.release),
	],
);
