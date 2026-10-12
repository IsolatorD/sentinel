import {
	BadGatewayException,
	BadRequestException,
	ConflictException,
	Injectable,
	Logger,
	NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type {
	ConnectJiraInput,
	JiraConnectionDto,
	TicketDto,
} from "@sentinel/shared";
import type { ApiEnv } from "../config/env.js";
import { ActivityService } from "../issues/activity/activity.service.js";
import { OrgAccessService } from "../organizations/org-access.service.js";
import { ProjectsService } from "../projects/projects.service.js";
import {
	IntegrationsRepository,
	type JiraRow,
	type TicketRow,
} from "./integrations.repository.js";
import { JiraClient, type JiraCredentials, JiraError } from "./jira.client.js";
import { SecretBox } from "./secret-box.js";
import { ticketDescription, ticketSummary } from "./ticket-description.js";

const NOT_CONNECTED: JiraConnectionDto = {
	connected: false,
	siteUrl: null,
	email: null,
	projectKey: null,
	issueType: null,
};

const toConnectionDto = (row: JiraRow): JiraConnectionDto => ({
	connected: true,
	siteUrl: row.siteUrl,
	email: row.email,
	projectKey: row.jiraProjectKey,
	issueType: row.issueType,
});

@Injectable()
export class IntegrationsService {
	private readonly logger = new Logger(IntegrationsService.name);
	private readonly box: SecretBox;
	private readonly webOrigin: string;

	constructor(
		private readonly repository: IntegrationsRepository,
		private readonly jira: JiraClient,
		private readonly access: OrgAccessService,
		private readonly projects: ProjectsService,
		private readonly activity: ActivityService,
		config: ConfigService<ApiEnv, true>,
	) {
		this.box = new SecretBox(config.get("BETTER_AUTH_SECRET", { infer: true }));
		this.webOrigin = config
			.get("WEB_ORIGIN", { infer: true })
			.replace(/\/$/, "");
	}

	// ---------- Conexión con Jira ----------

	/** Cualquier miembro puede ver si hay conexión (para ofrecer «crear ticket»); nunca se devuelve el token. */
	async getJira(
		userId: string,
		orgId: string,
		projectId: string,
	): Promise<JiraConnectionDto> {
		await this.authorize(userId, orgId, projectId, "member");
		const row = await this.repository.getJira(projectId);
		return row ? toConnectionDto(row) : NOT_CONNECTED;
	}

	/** Conecta (o actualiza) el proyecto con Jira tras comprobar que las credenciales sirven. */
	async connectJira(
		userId: string,
		orgId: string,
		projectId: string,
		input: ConnectJiraInput,
	): Promise<JiraConnectionDto> {
		await this.authorize(userId, orgId, projectId, "admin");
		const existing = await this.repository.getJira(projectId);

		let apiToken = input.apiToken;
		if (!apiToken) {
			// Sin token nuevo se conserva el guardado, pero solo si el sitio y el correo no cambian:
			// si no, se enviaría el token de una cuenta a otro sitio.
			if (
				!existing ||
				existing.siteUrl !== input.siteUrl ||
				existing.email !== input.email
			)
				throw new BadRequestException({ reason: "JIRA_TOKEN_REQUIRED" });
			apiToken = this.box.decrypt(existing.apiTokenEncrypted);
		}

		const credentials = {
			siteUrl: input.siteUrl,
			email: input.email,
			apiToken,
		};
		await this.call(() =>
			this.jira.verify(credentials, input.projectKey, input.issueType),
		);

		const row = await this.repository.upsertJira(projectId, {
			siteUrl: input.siteUrl,
			email: input.email,
			apiTokenEncrypted: input.apiToken
				? this.box.encrypt(input.apiToken)
				: (existing as JiraRow).apiTokenEncrypted,
			jiraProjectKey: input.projectKey,
			issueType: input.issueType,
		});
		return toConnectionDto(row);
	}

	/** Desconecta Jira; los tickets ya creados siguen ligados a sus issues. */
	async disconnectJira(
		userId: string,
		orgId: string,
		projectId: string,
	): Promise<void> {
		await this.authorize(userId, orgId, projectId, "admin");
		if (!(await this.repository.deleteJira(projectId)))
			throw new NotFoundException({ reason: "JIRA_NOT_CONNECTED" });
	}

	// ---------- Tickets de un issue ----------

	/** Crea un ticket en Jira a partir del issue y lo deja ligado a él. Cualquier miembro puede. */
	async createTicket(
		userId: string,
		orgId: string,
		projectId: string,
		issueId: string,
	): Promise<TicketDto> {
		await this.authorize(userId, orgId, projectId, "member");
		const connection = await this.repository.getJira(projectId);
		if (!connection)
			throw new BadRequestException({ reason: "JIRA_NOT_CONNECTED" });
		const found = await this.repository.issueForTicket(projectId, issueId);
		if (!found) throw new NotFoundException({ reason: "ISSUE_NOT_FOUND" });
		if (await this.repository.ticketOf(issueId))
			throw new ConflictException({ reason: "TICKET_EXISTS" });

		const url = `${this.webOrigin}/${found.orgSlug}/projects/${found.projectSlug}/issues/${issueId}`;
		const credentials = this.credentials(connection);
		const created = await this.call(() =>
			this.jira.createIssue(credentials, {
				projectKey: connection.jiraProjectKey,
				issueType: connection.issueType,
				summary: ticketSummary(found.issue.title),
				description: ticketDescription(found.issue, url),
			}),
		);

		const row = await this.repository.insertTicket({
			issueId,
			externalKey: created.key,
			externalUrl: created.url,
			createdBy: userId,
		});
		// Otra petición se adelantó mientras se creaba: ese ticket queda sin ligar en Jira.
		if (!row) {
			this.logger.warn(
				`ticket ${created.key} creado pero el issue ${issueId} ya tenía uno`,
			);
			throw new ConflictException({ reason: "TICKET_EXISTS" });
		}
		await this.activity.record(issueId, userId, "ticket", {
			action: "created",
			key: created.key,
			url: created.url,
		});
		return this.toTicketDto(row);
	}

	/** Quita el vínculo con el ticket (no lo borra en Jira). */
	async unlinkTicket(
		userId: string,
		orgId: string,
		projectId: string,
		issueId: string,
	): Promise<void> {
		await this.authorize(userId, orgId, projectId, "member");
		if (!(await this.repository.issueForTicket(projectId, issueId)))
			throw new NotFoundException({ reason: "ISSUE_NOT_FOUND" });
		const removed = await this.repository.deleteTicket(issueId);
		if (!removed) throw new NotFoundException({ reason: "TICKET_NOT_FOUND" });
		await this.activity.record(issueId, userId, "ticket", {
			action: "unlinked",
			key: removed.externalKey,
			url: removed.externalUrl,
		});
	}

	// ---------- Helpers ----------

	private async toTicketDto(row: TicketRow): Promise<TicketDto> {
		return {
			provider: "jira",
			key: row.externalKey,
			url: row.externalUrl,
			createdAt: row.createdAt.toISOString(),
			createdBy: row.createdBy
				? ((await this.repository.person(row.createdBy)) ?? null)
				: null,
		};
	}

	private credentials(row: JiraRow): JiraCredentials {
		try {
			return {
				siteUrl: row.siteUrl,
				email: row.email,
				apiToken: this.box.decrypt(row.apiTokenEncrypted),
			};
		} catch {
			// El secreto del servidor cambió: el token guardado ya no se puede leer.
			throw new BadRequestException({ reason: "JIRA_AUTH_FAILED" });
		}
	}

	/** Traduce los fallos del cliente a respuestas HTTP; el detalle de Jira solo va al log. */
	private async call<T>(run: () => Promise<T>): Promise<T> {
		try {
			return await run();
		} catch (error) {
			if (!(error instanceof JiraError)) throw error;
			if (error.code === "JIRA_REQUEST_FAILED") {
				this.logger.warn(error.message);
				throw new BadGatewayException({ reason: error.code });
			}
			throw new BadRequestException({ reason: error.code });
		}
	}

	private async authorize(
		userId: string,
		orgId: string,
		projectId: string,
		level: "member" | "admin",
	): Promise<void> {
		await this.access.assert(userId, orgId, level);
		await this.projects.ensureExists(orgId, projectId);
	}
}
