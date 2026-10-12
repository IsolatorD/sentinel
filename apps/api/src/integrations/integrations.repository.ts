import { Inject, Injectable } from "@nestjs/common";
import {
	and,
	type Database,
	eq,
	issue,
	issueTicket,
	jiraConnection,
	organization,
	project,
	user,
} from "@sentinel/db";
import { DB } from "../database/database.module.js";

export type JiraRow = typeof jiraConnection.$inferSelect;
export type TicketRow = typeof issueTicket.$inferSelect;

export interface JiraValues {
	siteUrl: string;
	email: string;
	apiTokenEncrypted: string;
	jiraProjectKey: string;
	issueType: string;
}

/** El issue con lo necesario para escribir su ticket y el enlace de vuelta. */
export interface IssueForTicket {
	issue: typeof issue.$inferSelect;
	projectSlug: string;
	orgSlug: string;
}

// Única capa que conoce Drizzle para las integraciones.
@Injectable()
export class IntegrationsRepository {
	constructor(@Inject(DB) private readonly db: Database) {}

	async getJira(projectId: string): Promise<JiraRow | undefined> {
		const [row] = await this.db
			.select()
			.from(jiraConnection)
			.where(eq(jiraConnection.projectId, projectId));
		return row;
	}

	async upsertJira(projectId: string, values: JiraValues): Promise<JiraRow> {
		const [row] = await this.db
			.insert(jiraConnection)
			.values({ projectId, ...values })
			.onConflictDoUpdate({
				target: jiraConnection.projectId,
				set: { ...values, updatedAt: new Date() },
			})
			.returning();
		return row;
	}

	async deleteJira(projectId: string): Promise<boolean> {
		const rows = await this.db
			.delete(jiraConnection)
			.where(eq(jiraConnection.projectId, projectId))
			.returning({ id: jiraConnection.projectId });
		return rows.length > 0;
	}

	async issueForTicket(
		projectId: string,
		issueId: string,
	): Promise<IssueForTicket | undefined> {
		const [row] = await this.db
			.select({
				issue,
				projectSlug: project.slug,
				orgSlug: organization.slug,
			})
			.from(issue)
			.innerJoin(project, eq(project.id, issue.projectId))
			.innerJoin(organization, eq(organization.id, project.organizationId))
			.where(and(eq(issue.id, issueId), eq(issue.projectId, projectId)));
		return row;
	}

	async ticketOf(issueId: string): Promise<TicketRow | undefined> {
		const [row] = await this.db
			.select()
			.from(issueTicket)
			.where(eq(issueTicket.issueId, issueId));
		return row;
	}

	/** `false` si el issue ya tenía ticket (otra petición se adelantó). */
	async insertTicket(values: {
		issueId: string;
		externalKey: string;
		externalUrl: string;
		createdBy: string;
	}): Promise<TicketRow | undefined> {
		const [row] = await this.db
			.insert(issueTicket)
			.values(values)
			.onConflictDoNothing()
			.returning();
		return row;
	}

	async deleteTicket(issueId: string): Promise<TicketRow | undefined> {
		const [row] = await this.db
			.delete(issueTicket)
			.where(eq(issueTicket.issueId, issueId))
			.returning();
		return row;
	}

	async person(userId: string) {
		const [row] = await this.db
			.select({ id: user.id, name: user.name, email: user.email })
			.from(user)
			.where(eq(user.id, userId));
		return row;
	}
}
