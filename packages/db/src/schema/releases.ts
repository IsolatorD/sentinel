import {
	index,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import { project } from "./projects.js";

// Una versión desplegada de la app de un proyecto. Se crea sola al llegar el primer evento
// (o al subir sus source maps), así que no hace falta registrarla de antemano.
export const release = pgTable(
	"release",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		projectId: uuid("project_id")
			.notNull()
			.references(() => project.id, { onDelete: "cascade" }),
		version: text("version").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(t) => [
		uniqueIndex("release_project_version_idx").on(t.projectId, t.version),
		index("release_project_created_idx").on(t.projectId, t.createdAt),
	],
);
