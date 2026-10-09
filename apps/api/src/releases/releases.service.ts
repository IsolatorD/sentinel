import { Injectable, NotFoundException } from "@nestjs/common";
import type { ReleaseDto } from "@sentinel/shared";
import { OrgAccessService } from "../organizations/org-access.service.js";
import { ProjectsService } from "../projects/projects.service.js";
import { type ReleaseRow, ReleasesRepository } from "./releases.repository.js";

const iso = (value: string | Date | null): string | null =>
	value === null ? null : new Date(value).toISOString();

const toDto = (row: ReleaseRow): ReleaseDto => ({
	version: row.version,
	createdAt: row.createdAt.toISOString(),
	eventCount: row.eventCount,
	newIssueCount: row.newIssueCount,
	artifactCount: row.artifactCount,
	firstEventAt: iso(row.firstEventAt),
	lastEventAt: iso(row.lastEventAt),
});

@Injectable()
export class ReleasesService {
	constructor(
		private readonly releases: ReleasesRepository,
		private readonly access: OrgAccessService,
		private readonly projects: ProjectsService,
	) {}

	async list(
		userId: string,
		orgId: string,
		projectId: string,
	): Promise<ReleaseDto[]> {
		await this.authorize(userId, orgId, projectId, "member");
		return (await this.releases.list(projectId)).map(toDto);
	}

	async get(
		userId: string,
		orgId: string,
		projectId: string,
		version: string,
	): Promise<ReleaseDto> {
		await this.authorize(userId, orgId, projectId, "member");
		const row = await this.releases.find(projectId, version);
		if (!row) throw new NotFoundException({ reason: "RELEASE_NOT_FOUND" });
		return toDto(row);
	}

	async remove(
		userId: string,
		orgId: string,
		projectId: string,
		version: string,
	): Promise<void> {
		await this.authorize(userId, orgId, projectId, "admin");
		if (!(await this.releases.delete(projectId, version))) {
			throw new NotFoundException({ reason: "RELEASE_NOT_FOUND" });
		}
	}

	async environments(
		userId: string,
		orgId: string,
		projectId: string,
	): Promise<string[]> {
		await this.authorize(userId, orgId, projectId, "member");
		return this.releases.listEnvironments(projectId);
	}

	// ---------- Uso desde otros módulos (sin comprobación de permisos) ----------

	/** Última release creada del proyecto: la usa "resolver en la próxima release". */
	latestVersion(projectId: string): Promise<string | undefined> {
		return this.releases.latestVersion(projectId);
	}

	ensure(projectId: string, version: string): Promise<void> {
		return this.releases.ensure(projectId, version);
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
