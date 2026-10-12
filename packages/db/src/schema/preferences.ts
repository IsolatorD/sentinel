import { boolean, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth.js";

/**
 * Preferencias de una persona, separadas de la tabla de usuarios de Better Auth. `locale` decide en qué
 * idioma se le escriben los correos; `theme` y `toursSeen` hacen que su experiencia la siga entre dispositivos.
 */
export const userPreference = pgTable("user_preference", {
	userId: text("user_id")
		.primaryKey()
		.references(() => user.id, { onDelete: "cascade" }),
	locale: text("locale"),
	theme: text("theme"),
	toursSeen: jsonb("tours_seen").$type<string[]>().notNull().default([]),
	/** Avisar por correo cuando le asignan un issue. */
	emailOnAssign: boolean("email_on_assign").notNull().default(true),
	updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
