import { Inject, Injectable } from "@nestjs/common";
import {
	and,
	type Database,
	desc,
	eq,
	project,
	projectKey,
} from "@sentinel/db";
import { DB } from "../database/database.module.js";

export type ProjectRow = typeof project.$inferSelect;
export type KeyRow = typeof projectKey.$inferSelect;

/** El slug (o la clave) ya existe en la organización. */
export class UniqueConflictError extends Error {}

// Drizzle envuelve los errores de pg; el código SQLSTATE puede estar en `cause`.
function isUniqueViolation(error: unknown): boolean {
	const e = error as { code?: string; cause?: { code?: string } };
	return e?.code === "23505" || e?.cause?.code === "23505";
}

// Única capa que conoce Drizzle para proyectos y claves.
@Injectable()
export class ProjectsRepository {
	constructor(@Inject(DB) private readonly db: Database) {}

	// ---------- Proyectos ----------

	listByOrganization(organizationId: string): Promise<ProjectRow[]> {
		return this.db
			.select()
			.from(project)
			.where(eq(project.organizationId, organizationId))
			.orderBy(desc(project.createdAt));
	}

	async findInOrganization(
		organizationId: string,
		projectId: string,
	): Promise<ProjectRow | undefined> {
		const [row] = await this.db
			.select()
			.from(project)
			.where(
				and(
					eq(project.id, projectId),
					eq(project.organizationId, organizationId),
				),
			)
			.limit(1);
		return row;
	}

	/** Crea el proyecto con su primera clave, de forma atómica. */
	async createWithKey(
		input: {
			organizationId: string;
			name: string;
			slug: string;
			platform: string;
		},
		publicKey: string,
	): Promise<{ project: ProjectRow; key: KeyRow }> {
		try {
			return await this.db.transaction(async (tx) => {
				const [created] = await tx.insert(project).values(input).returning();
				const [key] = await tx
					.insert(projectKey)
					.values({ projectId: created.id, publicKey })
					.returning();
				return { project: created, key };
			});
		} catch (error) {
			if (isUniqueViolation(error)) throw new UniqueConflictError();
			throw error;
		}
	}

	async update(
		organizationId: string,
		projectId: string,
		patch: Partial<
			Pick<
				ProjectRow,
				| "name"
				| "platform"
				| "retentionDays"
				| "monthlyEventQuota"
				| "monthlyTransactionQuota"
			>
		>,
	): Promise<ProjectRow | undefined> {
		const [row] = await this.db
			.update(project)
			.set(patch)
			.where(
				and(
					eq(project.id, projectId),
					eq(project.organizationId, organizationId),
				),
			)
			.returning();
		return row;
	}

	async delete(organizationId: string, projectId: string): Promise<boolean> {
		const rows = await this.db
			.delete(project)
			.where(
				and(
					eq(project.id, projectId),
					eq(project.organizationId, organizationId),
				),
			)
			.returning({ id: project.id });
		return rows.length > 0;
	}

	// ---------- Claves ----------

	listKeys(projectId: string): Promise<KeyRow[]> {
		return this.db
			.select()
			.from(projectKey)
			.where(eq(projectKey.projectId, projectId))
			.orderBy(desc(projectKey.createdAt));
	}

	async insertKey(
		projectId: string,
		label: string,
		publicKey: string,
	): Promise<KeyRow> {
		const [key] = await this.db
			.insert(projectKey)
			.values({ projectId, label, publicKey })
			.returning();
		return key;
	}

	async updateKey(
		projectId: string,
		keyId: string,
		patch: { label?: string; isActive?: boolean },
	): Promise<KeyRow | undefined> {
		const [key] = await this.db
			.update(projectKey)
			.set(patch)
			.where(and(eq(projectKey.id, keyId), eq(projectKey.projectId, projectId)))
			.returning();
		return key;
	}

	async deleteKey(projectId: string, keyId: string): Promise<boolean> {
		const rows = await this.db
			.delete(projectKey)
			.where(and(eq(projectKey.id, keyId), eq(projectKey.projectId, projectId)))
			.returning({ id: projectKey.id });
		return rows.length > 0;
	}

	async isActiveKey(projectId: string, publicKey: string): Promise<boolean> {
		const [row] = await this.db
			.select({ id: projectKey.id })
			.from(projectKey)
			.where(
				and(
					eq(projectKey.projectId, projectId),
					eq(projectKey.publicKey, publicKey),
					eq(projectKey.isActive, true),
				),
			)
			.limit(1);
		return Boolean(row);
	}
}
