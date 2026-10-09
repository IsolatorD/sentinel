import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import {
	BadRequestException,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import {
	type ArtifactDto,
	looksLikeSourceMap,
	MAX_SOURCE_MAP_BYTES,
	normalizeArtifactName,
} from "@sentinel/shared";
import { OrgAccessService } from "../organizations/org-access.service.js";
import { ProjectsService } from "../projects/projects.service.js";
import type { ArtifactActor } from "./artifact-auth.guard.js";
import { type ArtifactRow, ReleasesRepository } from "./releases.repository.js";

const toDto = (row: ArtifactRow): ArtifactDto => ({
	id: row.id,
	name: row.name,
	size: row.size,
	sha256: row.sha256,
	createdAt: row.createdAt.toISOString(),
});

@Injectable()
export class ArtifactsService {
	constructor(
		private readonly releases: ReleasesRepository,
		private readonly access: OrgAccessService,
		private readonly projects: ProjectsService,
	) {}

	async list(
		userId: string,
		orgId: string,
		projectId: string,
		version: string,
	): Promise<ArtifactDto[]> {
		await this.access.assert(userId, orgId, "member");
		await this.projects.ensureExists(orgId, projectId);
		return (await this.releases.listArtifacts(projectId, version)).map(toDto);
	}

	async upload(
		actor: ArtifactActor,
		orgId: string,
		projectId: string,
		version: string,
		rawName: string | undefined,
		body: unknown,
	): Promise<ArtifactDto> {
		// Un token solo vale para su propia organización; quien no la conoce no debe saber que existe.
		if (actor.kind === "token") {
			if (actor.organizationId !== orgId)
				throw new NotFoundException("Organization not found");
		} else {
			await this.access.assert(actor.userId, orgId, "admin");
		}
		await this.projects.ensureExists(orgId, projectId);

		const name = rawName ? normalizeArtifactName(rawName) : null;
		if (!name) {
			throw new BadRequestException(
				"Query parameter 'name' must be the minified file path, e.g. ~/assets/app.js",
			);
		}
		if (!version.trim() || version.length > 256)
			throw new BadRequestException("Invalid release version");

		if (!Buffer.isBuffer(body) || body.length === 0) {
			throw new BadRequestException(
				"The body must be the raw source map (Content-Type: application/octet-stream)",
			);
		}
		if (body.length > MAX_SOURCE_MAP_BYTES)
			throw new BadRequestException("Source map too large");

		let parsed: unknown;
		try {
			parsed = JSON.parse(body.toString("utf8"));
		} catch {
			throw new BadRequestException("The file is not valid JSON");
		}
		if (!looksLikeSourceMap(parsed))
			throw new BadRequestException("The file is not a source map (version 3)");

		const row = await this.releases.upsertArtifact(projectId, version, {
			name,
			size: body.length,
			sha256: createHash("sha256").update(body).digest("hex"),
			content: gzipSync(body),
		});
		return toDto(row);
	}

	async remove(
		userId: string,
		orgId: string,
		projectId: string,
		version: string,
		artifactId: string,
	): Promise<void> {
		await this.access.assert(userId, orgId, "admin");
		await this.projects.ensureExists(orgId, projectId);
		if (!(await this.releases.deleteArtifact(projectId, version, artifactId))) {
			throw new NotFoundException("File not found");
		}
	}
}
