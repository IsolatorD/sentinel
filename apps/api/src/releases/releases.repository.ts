import { Inject, Injectable } from "@nestjs/common";
import {
	and,
	type Database,
	desc,
	eq,
	event,
	release,
	releaseArtifact,
	sql,
} from "@sentinel/db";
import { DB } from "../database/database.module.js";

export interface ArtifactRow {
	id: string;
	name: string;
	size: number;
	sha256: string;
	createdAt: Date;
}

export interface ReleaseRow {
	version: string;
	createdAt: Date;
	eventCount: number;
	newIssueCount: number;
	artifactCount: number;
	firstEventAt: string | null;
	lastEventAt: string | null;
}

// Única capa que conoce Drizzle para releases y entornos.
@Injectable()
export class ReleasesRepository {
	constructor(@Inject(DB) private readonly db: Database) {}

	/**
	 * Los contadores son subconsultas correlacionadas con la fila de `release`. Se escriben con
	 * nombres de tabla explícitos: en una consulta de una sola tabla Drizzle omite el prefijo de
	 * las columnas, y `project_id = project_id` se resolvería dentro de la subconsulta (siempre
	 * verdadero), mezclando los datos de todos los proyectos.
	 */
	private selection() {
		const outerProject = sql.raw('"release"."project_id"');
		const outerVersion = sql.raw('"release"."version"');
		return {
			version: release.version,
			createdAt: release.createdAt,
			eventCount: sql<number>`(select count(*)::int from "event" as e where e."project_id" = ${outerProject} and e."release" = ${outerVersion})`,
			newIssueCount: sql<number>`(select count(*)::int from "issue" as i where i."project_id" = ${outerProject} and i."first_release" = ${outerVersion})`,
			artifactCount: sql<number>`(select count(*)::int from "release_artifact" as a where a."release_id" = "release"."id")`,
			firstEventAt: sql<
				string | null
			>`(select min(e."timestamp") from "event" as e where e."project_id" = ${outerProject} and e."release" = ${outerVersion})`,
			lastEventAt: sql<
				string | null
			>`(select max(e."timestamp") from "event" as e where e."project_id" = ${outerProject} and e."release" = ${outerVersion})`,
		};
	}

	list(projectId: string): Promise<ReleaseRow[]> {
		return this.db
			.select(this.selection())
			.from(release)
			.where(eq(release.projectId, projectId))
			.orderBy(desc(release.createdAt), desc(release.version))
			.limit(200);
	}

	async find(
		projectId: string,
		version: string,
	): Promise<ReleaseRow | undefined> {
		const [row] = await this.db
			.select(this.selection())
			.from(release)
			.where(
				and(eq(release.projectId, projectId), eq(release.version, version)),
			)
			.limit(1);
		return row;
	}

	/** Registra la release si no existía (idempotente). */
	async ensure(projectId: string, version: string): Promise<void> {
		await this.db
			.insert(release)
			.values({ projectId, version })
			.onConflictDoNothing();
	}

	async delete(projectId: string, version: string): Promise<boolean> {
		const rows = await this.db
			.delete(release)
			.where(
				and(eq(release.projectId, projectId), eq(release.version, version)),
			)
			.returning({ id: release.id });
		return rows.length > 0;
	}

	/** La release creada más recientemente, o undefined si el proyecto aún no tiene ninguna. */
	async latestVersion(projectId: string): Promise<string | undefined> {
		const [row] = await this.db
			.select({ version: release.version })
			.from(release)
			.where(eq(release.projectId, projectId))
			.orderBy(desc(release.createdAt), desc(release.version))
			.limit(1);
		return row?.version;
	}

	async listEnvironments(projectId: string): Promise<string[]> {
		const rows = await this.db
			.selectDistinct({ environment: event.environment })
			.from(event)
			.where(eq(event.projectId, projectId))
			.orderBy(event.environment);
		return rows
			.map((r) => r.environment)
			.filter((e): e is string => e !== null);
	}

	// ---------- Archivos de la release (source maps) ----------

	async listArtifacts(
		projectId: string,
		version: string,
	): Promise<ArtifactRow[]> {
		return this.db
			.select({
				id: releaseArtifact.id,
				name: releaseArtifact.name,
				size: releaseArtifact.size,
				sha256: releaseArtifact.sha256,
				createdAt: releaseArtifact.createdAt,
			})
			.from(releaseArtifact)
			.innerJoin(release, eq(release.id, releaseArtifact.releaseId))
			.where(
				and(eq(release.projectId, projectId), eq(release.version, version)),
			)
			.orderBy(releaseArtifact.name);
	}

	/** Guarda (o reemplaza) el archivo de esa release con ese nombre; crea la release si hace falta. */
	async upsertArtifact(
		projectId: string,
		version: string,
		file: { name: string; size: number; sha256: string; content: Buffer },
	): Promise<ArtifactRow> {
		return this.db.transaction(async (tx) => {
			await tx
				.insert(release)
				.values({ projectId, version })
				.onConflictDoNothing();
			const [rel] = await tx
				.select({ id: release.id })
				.from(release)
				.where(
					and(eq(release.projectId, projectId), eq(release.version, version)),
				)
				.limit(1);

			const [row] = await tx
				.insert(releaseArtifact)
				.values({ projectId, releaseId: rel.id, ...file })
				.onConflictDoUpdate({
					target: [releaseArtifact.releaseId, releaseArtifact.name],
					set: {
						size: file.size,
						sha256: file.sha256,
						content: file.content,
						createdAt: new Date(),
					},
				})
				.returning({
					id: releaseArtifact.id,
					name: releaseArtifact.name,
					size: releaseArtifact.size,
					sha256: releaseArtifact.sha256,
					createdAt: releaseArtifact.createdAt,
				});
			return row;
		});
	}

	async deleteArtifact(
		projectId: string,
		version: string,
		artifactId: string,
	): Promise<boolean> {
		const [rel] = await this.db
			.select({ id: release.id })
			.from(release)
			.where(
				and(eq(release.projectId, projectId), eq(release.version, version)),
			)
			.limit(1);
		if (!rel) return false;
		const rows = await this.db
			.delete(releaseArtifact)
			.where(
				and(
					eq(releaseArtifact.id, artifactId),
					eq(releaseArtifact.releaseId, rel.id),
				),
			)
			.returning({ id: releaseArtifact.id });
		return rows.length > 0;
	}
}
