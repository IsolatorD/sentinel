import {
	boolean,
	index,
	integer,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import { organization } from "./auth.js";

export const project = pgTable(
	"project",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: text("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		slug: text("slug").notNull(),
		platform: text("platform").notNull().default("javascript"),
		// Cuántos días se conservan los eventos y las transacciones; el worker borra lo más antiguo cada día.
		retentionDays: integer("retention_days").notNull().default(90),
		// Límites mensuales de ingesta (null = sin límite). Al superarlos la API responde 429.
		monthlyEventQuota: integer("monthly_event_quota"),
		monthlyTransactionQuota: integer("monthly_transaction_quota"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(t) => [
		uniqueIndex("project_org_slug_idx").on(t.organizationId, t.slug),
		index("project_organization_id_idx").on(t.organizationId),
	],
);

// Clave pública que forma parte de la DSN: https://<publicKey>@host/<projectId>
export const projectKey = pgTable(
	"project_key",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		projectId: uuid("project_id")
			.notNull()
			.references(() => project.id, { onDelete: "cascade" }),
		publicKey: text("public_key").notNull().unique(),
		label: text("label").notNull().default("Default"),
		isActive: boolean("is_active").notNull().default(true),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(t) => [index("project_key_project_id_idx").on(t.projectId)],
);
