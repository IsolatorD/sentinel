import { Inject, Injectable } from "@nestjs/common";
import {
	and,
	type Database,
	eq,
	event,
	inArray,
	issue,
	release,
	sql,
	TransactionRollbackError,
} from "@sentinel/db";
import type { IssueStatus } from "@sentinel/shared";
import { DB } from "../database/database.module.js";
import { nextStatusOnEvent } from "./domain/regression.js";
import { compareReleases } from "./domain/version.js";
import {
	EventRepository,
	type NewEvent,
	type SaveResult,
} from "./event.repository.js";

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

@Injectable()
export class DrizzleEventRepository extends EventRepository {
	constructor(@Inject(DB) private readonly db: Database) {
		super();
	}

	async save(input: NewEvent): Promise<SaveResult> {
		try {
			return await this.db.transaction(async (tx) => {
				// La release se registra sola al verla por primera vez.
				if (input.release) {
					await tx
						.insert(release)
						.values({ projectId: input.projectId, version: input.release })
						.onConflictDoNothing();
				}

				const { issueId, isNew, regressed } = await this.upsertIssue(tx, input);

				const inserted = await tx
					.insert(event)
					.values({
						id: input.id,
						projectId: input.projectId,
						issueId,
						timestamp: input.timestamp,
						receivedAt: input.receivedAt,
						level: input.level,
						type: input.analysis.type,
						message: input.message,
						release: input.release,
						environment: input.environment,
						platform: input.platform,
						userIdentifier: input.userIdentifier,
						traceId: input.traceId,
						payload: input.payload,
					})
					.onConflictDoNothing()
					.returning({ id: event.id });

				// Evento duplicado: deshacer todo lo que se hizo en el issue.
				if (inserted.length === 0) tx.rollback();

				return {
					eventId: input.id,
					issueId,
					isNewIssue: isNew,
					regressed,
					duplicate: false,
				};
			});
		} catch (error) {
			if (error instanceof TransactionRollbackError) {
				return {
					eventId: input.id,
					isNewIssue: false,
					regressed: false,
					duplicate: true,
				};
			}
			throw error;
		}
	}

	/** Crea el issue o, si ya existe, lo actualiza aplicando la regla de regresión. */
	private async upsertIssue(
		tx: Tx,
		input: NewEvent,
	): Promise<{ issueId: string; isNew: boolean; regressed: boolean }> {
		const { analysis } = input;

		const [created] = await tx
			.insert(issue)
			.values({
				projectId: input.projectId,
				fingerprint: analysis.fingerprint,
				title: analysis.title,
				culprit: analysis.culprit,
				type: analysis.type,
				level: input.level,
				eventCount: 1,
				firstRelease: input.release,
				lastRelease: input.release,
				firstSeen: input.timestamp,
				lastSeen: input.timestamp,
			})
			.onConflictDoNothing({ target: [issue.projectId, issue.fingerprint] })
			.returning({ id: issue.id });
		if (created) return { issueId: created.id, isNew: true, regressed: false };

		// Ya existía: se bloquea la fila para decidir su nuevo estado sin carreras.
		const [row] = await tx
			.select()
			.from(issue)
			.where(
				and(
					eq(issue.projectId, input.projectId),
					eq(issue.fingerprint, analysis.fingerprint),
				),
			)
			.for("update");

		const dates = await this.releaseDates(tx, input.projectId, [
			input.release,
			row.resolvedRelease,
		]);
		const decision = nextStatusOnEvent(
			{
				status: row.status as IssueStatus,
				resolvedRelease: row.resolvedRelease,
				resolvedInclusive: row.resolvedInclusive,
			},
			input.release,
			(a, b) => compareReleases(a, b, (v) => dates.get(v)),
		);

		const isNewest = input.timestamp >= row.lastSeen;
		const isOldest = input.timestamp < row.firstSeen;

		await tx
			.update(issue)
			.set({
				eventCount: sql`${issue.eventCount} + 1`,
				firstSeen: isOldest ? input.timestamp : row.firstSeen,
				lastSeen: isNewest ? input.timestamp : row.lastSeen,
				level: input.level,
				status: decision.status,
				lastRelease: isNewest
					? (input.release ?? row.lastRelease)
					: row.lastRelease,
				firstRelease: isOldest
					? (input.release ?? row.firstRelease)
					: (row.firstRelease ?? input.release),
				...(decision.regressed && {
					regressedAt: new Date(),
					regressedInRelease: input.release ?? null,
					// Ya está reabierto: la resolución anterior deja de aplicar.
					resolvedRelease: null,
					resolvedInclusive: false,
				}),
			})
			.where(eq(issue.id, row.id));

		return { issueId: row.id, isNew: false, regressed: decision.regressed };
	}

	/** Fechas de creación de las releases pedidas (para ordenar versiones que no son semver). */
	private async releaseDates(
		tx: Tx,
		projectId: string,
		versions: Array<string | null | undefined>,
	): Promise<Map<string, Date>> {
		const wanted = [
			...new Set(versions.filter((v): v is string => Boolean(v))),
		];
		if (wanted.length === 0) return new Map();
		const rows = await tx
			.select({ version: release.version, createdAt: release.createdAt })
			.from(release)
			.where(
				and(eq(release.projectId, projectId), inArray(release.version, wanted)),
			);
		return new Map(rows.map((r) => [r.version, r.createdAt]));
	}
}
