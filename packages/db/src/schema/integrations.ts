import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth.js";
import { issue } from "./events.js";
import { project } from "./projects.js";

/**
 * Conexión de un proyecto con Jira Cloud. El API token se guarda cifrado (AES-256-GCM) y nunca se
 * devuelve por la API: solo sirve para crear tickets en nombre de quien configuró la conexión.
 */
export const jiraConnection = pgTable("jira_connection", {
	projectId: uuid("project_id")
		.primaryKey()
		.references(() => project.id, { onDelete: "cascade" }),
	siteUrl: text("site_url").notNull(),
	email: text("email").notNull(),
	apiTokenEncrypted: text("api_token_encrypted").notNull(),
	jiraProjectKey: text("jira_project_key").notNull(),
	issueType: text("issue_type").notNull().default("Bug"),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/** Ticket de un sistema externo ligado a un issue (hoy solo Jira; un issue tiene como mucho uno). */
export const issueTicket = pgTable("issue_ticket", {
	issueId: uuid("issue_id")
		.primaryKey()
		.references(() => issue.id, { onDelete: "cascade" }),
	provider: text("provider").notNull().default("jira"),
	externalKey: text("external_key").notNull(),
	externalUrl: text("external_url").notNull(),
	createdBy: text("created_by").references(() => user.id, {
		onDelete: "set null",
	}),
	createdAt: timestamp("created_at").defaultNow().notNull(),
});
