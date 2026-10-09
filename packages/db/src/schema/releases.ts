import {
	customType,
	index,
	integer,
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

// bytea con Buffer de Node (los source maps se guardan comprimidos).
const bytea = customType<{ data: Buffer; driverData: Buffer }>({
	dataType: () => "bytea",
});

// Archivo asociado a una release: hoy, los source maps. `name` es la URL del archivo minificado
// con "~" en lugar del origen (p. ej. "~/assets/app.3f2a.js"), para que valga en cualquier dominio.
export const releaseArtifact = pgTable(
	"release_artifact",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		projectId: uuid("project_id")
			.notNull()
			.references(() => project.id, { onDelete: "cascade" }),
		releaseId: uuid("release_id")
			.notNull()
			.references(() => release.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		/** Tamaño del archivo original, sin comprimir. */
		size: integer("size").notNull(),
		sha256: text("sha256").notNull(),
		/** Contenido comprimido con gzip. */
		content: bytea("content").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(t) => [
		uniqueIndex("release_artifact_release_name_idx").on(t.releaseId, t.name),
		index("release_artifact_project_idx").on(t.projectId),
	],
);
