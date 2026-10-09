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
				throw new NotFoundException({ reason: "ORGANIZATION_NOT_FOUND" });
		} else {
			await this.access.assert(actor.userId, orgId, "admin");
		}
		await this.projects.ensureExists(orgId, projectId);

		const name = rawName ? normalizeArtifactName(rawName) : null;
		if (!name) {
			throw new BadRequestException({ reason: "ARTIFACT_NAME_REQUIRED" });
		}
		if (!version.trim() || version.length > 256)
			throw new BadRequestException({ reason: "INVALID_RELEASE_VERSION" });

		if (!Buffer.isBuffer(body) || body.length === 0) {
			throw new BadRequestException({ reason: "ARTIFACT_BODY_REQUIRED" });
		}
		if (body.length > MAX_SOURCE_MAP_BYTES)
			throw new BadRequestException({ reason: "SOURCE_MAP_TOO_LARGE" });

		let parsed: unknown;
		try {
			parsed = JSON.parse(body.toString("utf8"));
		} catch {
			throw new BadRequestException({ reason: "SOURCE_MAP_NOT_JSON" });
		}
		if (!looksLikeSourceMap(parsed))
			throw new BadRequestException({ reason: "SOURCE_MAP_INVALID" });

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
			throw new NotFoundException({ reason: "FILE_NOT_FOUND" });
		}
	}
}
