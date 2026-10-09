import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
	and,
	type Database,
	desc,
	eq,
	project,
	projectKey,
} from "@sentinel/db";
import type {
	CreateProjectInput,
	CreateProjectKeyInput,
	ProjectDto,
	ProjectKeyDto,
	UpdateProjectInput,
	UpdateProjectKeyInput,
} from "@sentinel/shared";
import { DB } from "../database/database.module.js";
import { OrgAccessService } from "../organizations/org-access.service.js";
import { buildDsn } from "./dsn.js";
import {
	generatePublicKey,
	isUniqueViolation,
	slugify,
	withSuffix,
} from "./slug.js";

type ProjectRow = typeof project.$inferSelect;
type KeyRow = typeof projectKey.$inferSelect;

@Injectable()
export class ProjectsService {
	private readonly publicApiUrl: string;

	constructor(
		@Inject(DB) private readonly db: Database,
		private readonly access: OrgAccessService,
		config: ConfigService,
	) {
		const port = config.get<string>("API_PORT", "3000");
		this.publicApiUrl = config.get<string>(
			"PUBLIC_API_URL",
			config.get<string>("BETTER_AUTH_URL", `http://localhost:${port}`),
		);
	}

	// ---------- Proyectos ----------

	async list(userId: string, orgId: string): Promise<ProjectDto[]> {
		await this.access.assert(userId, orgId, "member");
		const rows = await this.db
			.select()
			.from(project)
			.where(eq(project.organizationId, orgId))
			.orderBy(desc(project.createdAt));
		return rows.map((r) => this.toProjectDto(r));
	}

	async create(
		userId: string,
		orgId: string,
		input: CreateProjectInput,
	): Promise<ProjectDto> {
		await this.access.assert(userId, orgId, "admin");

		const base = slugify(input.name);
		for (let attempt = 0; attempt < 4; attempt++) {
			const slug = attempt === 0 ? base : withSuffix(base);
			try {
				return await this.db.transaction(async (tx) => {
					const [created] = await tx
						.insert(project)
						.values({
							organizationId: orgId,
							name: input.name,
							slug,
							platform: input.platform,
						})
						.returning();
					const [key] = await tx
						.insert(projectKey)
						.values({ projectId: created.id, publicKey: generatePublicKey() })
						.returning();
					return this.toProjectDto(created, [key]);
				});
			} catch (error) {
				// Slug repetido en la organización: reintentar con sufijo aleatorio.
				if (!isUniqueViolation(error)) throw error;
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
		const row = await this.findProject(orgId, projectId);
		const keys = await this.db
			.select()
			.from(projectKey)
			.where(eq(projectKey.projectId, projectId))
			.orderBy(desc(projectKey.createdAt));
		return this.toProjectDto(row, keys);
	}

	async update(
		userId: string,
		orgId: string,
		projectId: string,
		input: UpdateProjectInput,
	): Promise<ProjectDto> {
		await this.access.assert(userId, orgId, "admin");
		await this.findProject(orgId, projectId);
		const [updated] = await this.db
			.update(project)
			.set({ name: input.name, platform: input.platform })
			.where(and(eq(project.id, projectId), eq(project.organizationId, orgId)))
			.returning();
		return this.toProjectDto(updated);
	}

	async remove(
		userId: string,
		orgId: string,
		projectId: string,
	): Promise<void> {
		await this.access.assert(userId, orgId, "admin");
		await this.findProject(orgId, projectId);
		await this.db
			.delete(project)
			.where(and(eq(project.id, projectId), eq(project.organizationId, orgId)));
	}

	// ---------- Claves DSN ----------

	async createKey(
		userId: string,
		orgId: string,
		projectId: string,
		input: CreateProjectKeyInput,
	): Promise<ProjectKeyDto> {
		await this.access.assert(userId, orgId, "admin");
		await this.findProject(orgId, projectId);
		const [key] = await this.db
			.insert(projectKey)
			.values({
				projectId,
				label: input.label,
				publicKey: generatePublicKey(),
			})
			.returning();
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
		await this.findProject(orgId, projectId);
		const [key] = await this.db
			.update(projectKey)
			.set({ label: input.label, isActive: input.isActive })
			.where(and(eq(projectKey.id, keyId), eq(projectKey.projectId, projectId)))
			.returning();
		if (!key) throw new NotFoundException("Key not found");
		return this.toKeyDto(key);
	}

	async removeKey(
		userId: string,
		orgId: string,
		projectId: string,
		keyId: string,
	): Promise<void> {
		await this.access.assert(userId, orgId, "admin");
		await this.findProject(orgId, projectId);
		const deleted = await this.db
			.delete(projectKey)
			.where(and(eq(projectKey.id, keyId), eq(projectKey.projectId, projectId)))
			.returning({ id: projectKey.id });
		if (deleted.length === 0) throw new NotFoundException("Key not found");
	}

	// ---------- Helpers ----------

	// Siempre filtra por organización: un proyecto de otra org se trata como inexistente.
	private async findProject(
		orgId: string,
		projectId: string,
	): Promise<ProjectRow> {
		const [row] = await this.db
			.select()
			.from(project)
			.where(and(eq(project.id, projectId), eq(project.organizationId, orgId)))
			.limit(1);
		if (!row) throw new NotFoundException("Project not found");
		return row;
	}

	private toProjectDto(row: ProjectRow, keys?: KeyRow[]): ProjectDto {
		return {
			id: row.id,
			organizationId: row.organizationId,
			name: row.name,
			slug: row.slug,
			platform: row.platform,
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
