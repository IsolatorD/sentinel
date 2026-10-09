import {
	index,
	jsonb,
	pgTable,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth.js";
import { issue } from "./events.js";

/**
 * Historial de un issue: comentarios de las personas y los cambios que hicieron (estado, asignación).
 * `userId` es null si la persona se dio de baja; su nombre se conserva en `data` cuando hace falta.
 */
export const issueActivity = pgTable(
	"issue_activity",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		issueId: uuid("issue_id")
			.notNull()
			.references(() => issue.id, { onDelete: "cascade" }),
		userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
		type: text("type").notNull(), // comment | status | assignment
		body: text("body"),
		data: jsonb("data").$type<Record<string, unknown>>(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		editedAt: timestamp("edited_at", { withTimezone: true }),
	},
	(t) => [index("issue_activity_issue_created_idx").on(t.issueId, t.createdAt)],
);
