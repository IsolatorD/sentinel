import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { organization, user } from "./auth.js";

// Token de API de una organización: lo usa el CLI para subir source maps desde el CI.
// Solo se guarda el hash (sha256); el valor en claro se muestra una única vez al crearlo.
export const apiToken = pgTable(
	"api_token",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: text("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		tokenHash: text("token_hash").notNull().unique(),
		/** Primeros caracteres, para reconocerlo en la lista sin revelarlo. */
		tokenPrefix: text("token_prefix").notNull(),
		createdBy: text("created_by").references(() => user.id, {
			onDelete: "set null",
		}),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
	},
	(t) => [index("api_token_organization_idx").on(t.organizationId)],
);
