import { gunzipSync } from "node:zlib";
import { Inject, Injectable } from "@nestjs/common";
import { and, type Database, eq, release, releaseArtifact } from "@sentinel/db";
import { DB } from "../database/database.module.js";
import { SourceMapRepository } from "./source-map.repository.js";

@Injectable()
export class DrizzleSourceMapRepository extends SourceMapRepository {
	constructor(@Inject(DB) private readonly db: Database) {
		super();
	}

	async find(
		projectId: string,
		version: string,
		artifactName: string,
	): Promise<string | undefined> {
		const [row] = await this.db
			.select({ content: releaseArtifact.content })
			.from(releaseArtifact)
			.innerJoin(release, eq(release.id, releaseArtifact.releaseId))
			.where(
				and(
					eq(releaseArtifact.projectId, projectId),
					eq(release.version, version),
					eq(releaseArtifact.name, artifactName),
				),
			)
			.limit(1);
		return row ? gunzipSync(row.content).toString("utf8") : undefined;
	}
}
