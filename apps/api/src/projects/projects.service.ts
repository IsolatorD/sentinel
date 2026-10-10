import { Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type {
	CreateProjectInput,
	CreateProjectKeyInput,
	ProjectDto,
	ProjectKeyDto,
	UpdateProjectInput,
	UpdateProjectKeyInput,
} from "@sentinel/shared";
import type { ApiEnv } from "../config/env.js";
import { OrgAccessService } from "../organizations/org-access.service.js";
import { QuotaService } from "../quota/quota.service.js";
import { buildDsn } from "./domain/dsn.js";
import { generatePublicKey } from "./domain/public-key.js";
import { slugify, withSuffix } from "./domain/slug.js";
import {
	type KeyRow,
	type ProjectRow,
	ProjectsRepository,
	UniqueConflictError,
} from "./projects.repository.js";

const MAX_SLUG_ATTEMPTS = 4;

@Injectable()
export class ProjectsService {
	private readonly publicApiUrl: string;

	constructor(
		private readonly projects: ProjectsRepository,
		private readonly access: OrgAccessService,
		private readonly quota: QuotaService,
		config: ConfigService<ApiEnv, true>,
	) {
		this.publicApiUrl = config.get("PUBLIC_API_URL", { infer: true });
	}

	// ---------- Proyectos ----------

	async list(userId: string, orgId: string): Promise<ProjectDto[]> {
		await this.access.assert(userId, orgId, "member");
		const rows = await this.projects.listByOrganization(orgId);
		return rows.map((r) => this.toProjectDto(r));
	}

	async create(
		userId: string,
		orgId: string,
		input: CreateProjectInput,
	): Promise<ProjectDto> {
		await this.access.assert(userId, orgId, "admin");

		const base = slugify(input.name);
		for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt++) {
			const slug = attempt === 0 ? base : withSuffix(base);
			try {
				const { project, key } = await this.projects.createWithKey(
					{
						organizationId: orgId,
						name: input.name,
						slug,
						platform: input.platform,
					},
					generatePublicKey(),
				);
				return this.toProjectDto(project, [key]);
			} catch (error) {
				// Slug repetido en la organización: reintentar con sufijo aleatorio.
				if (!(error instanceof UniqueConflictError)) throw error;
			}
		}
		throw new Error("Could not generate a unique project slug");
	}

	async get(
		userId: string,
		orgId: string,
		projectId: string,
	): Promise<ProjectDto> {
		await this.access.assert(userId, orgId, "member");
		const row = await this.requireProject(orgId, projectId);
		const keys = await this.projects.listKeys(projectId);
		return this.toProjectDto(row, keys);
	}

	async update(
		userId: string,
		orgId: string,
		projectId: string,
		input: UpdateProjectInput,
	): Promise<ProjectDto> {
		await this.access.assert(userId, orgId, "admin");
		const row = await this.projects.update(orgId, projectId, input);
		if (!row) throw new NotFoundException({ reason: "PROJECT_NOT_FOUND" });
		// Los límites nuevos valen desde ya, sin esperar a que caduque la caché de la ingesta.
		this.quota.invalidate(projectId);
		return this.toProjectDto(row);
	}

	async remove(
		userId: string,
		orgId: string,
		projectId: string,
	): Promise<void> {
		await this.access.assert(userId, orgId, "admin");
		if (!(await this.projects.delete(orgId, projectId))) {
			throw new NotFoundException({ reason: "PROJECT_NOT_FOUND" });
		}
	}

	// ---------- Claves DSN ----------

	async createKey(
		userId: string,
		orgId: string,
		projectId: string,
		input: CreateProjectKeyInput,
	): Promise<ProjectKeyDto> {
		await this.access.assert(userId, orgId, "admin");
		await this.requireProject(orgId, projectId);
		const key = await this.projects.insertKey(
			projectId,
			input.label,
			generatePublicKey(),
		);
		return this.toKeyDto(key);
	}

	async updateKey(
		userId: string,
		orgId: string,
		projectId: string,
		keyId: string,
		input: UpdateProjectKeyInput,
	): Promise<ProjectKeyDto> {
		await this.access.assert(userId, orgId, "admin");
		await this.requireProject(orgId, projectId);
		const key = await this.projects.updateKey(projectId, keyId, input);
		if (!key) throw new NotFoundException({ reason: "KEY_NOT_FOUND" });
		return this.toKeyDto(key);
	}

	async removeKey(
		userId: string,
		orgId: string,
		projectId: string,
		keyId: string,
	): Promise<void> {
		await this.access.assert(userId, orgId, "admin");
		await this.requireProject(orgId, projectId);
		if (!(await this.projects.deleteKey(projectId, keyId))) {
			throw new NotFoundException({ reason: "KEY_NOT_FOUND" });
		}
	}

	// ---------- Uso desde otros módulos ----------

	/** Lanza 404 si el proyecto no existe en la organización. No comprueba permisos. */
	async ensureExists(orgId: string, projectId: string): Promise<void> {
		await this.requireProject(orgId, projectId);
	}

	/** ¿La clave pertenece al proyecto y está activa? La usa la ingesta de eventos. */
	isIngestKeyValid(projectId: string, publicKey: string): Promise<boolean> {
		return this.projects.isActiveKey(projectId, publicKey);
	}

	// ---------- Helpers ----------

	// Siempre filtra por organización: un proyecto de otra org se trata como inexistente.
	private async requireProject(
		orgId: string,
		projectId: string,
	): Promise<ProjectRow> {
		const row = await this.projects.findInOrganization(orgId, projectId);
		if (!row) throw new NotFoundException({ reason: "PROJECT_NOT_FOUND" });
		return row;
	}

	private toProjectDto(row: ProjectRow, keys?: KeyRow[]): ProjectDto {
		return {
			id: row.id,
			organizationId: row.organizationId,
			name: row.name,
			slug: row.slug,
			platform: row.platform,
			retentionDays: row.retentionDays,
			monthlyEventQuota: row.monthlyEventQuota,
			monthlyTransactionQuota: row.monthlyTransactionQuota,
			createdAt: row.createdAt.toISOString(),
			...(keys && { keys: keys.map((k) => this.toKeyDto(k)) }),
		};
	}

	private toKeyDto(row: KeyRow): ProjectKeyDto {
		return {
			id: row.id,
			projectId: row.projectId,
			label: row.label,
			publicKey: row.publicKey,
			isActive: row.isActive,
			dsn: buildDsn(this.publicApiUrl, row.publicKey, row.projectId),
			createdAt: row.createdAt.toISOString(),
		};
	}
}
