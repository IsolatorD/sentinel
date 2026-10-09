import { Inject, Injectable } from "@nestjs/common";
import {
	type Database,
	event,
	issue,
	sql,
	TransactionRollbackError,
} from "@sentinel/db";
import { DB } from "../database/database.module.js";
import {
	EventRepository,
	type NewEvent,
	type SaveResult,
} from "./event.repository.js";

@Injectable()
export class DrizzleEventRepository extends EventRepository {
	constructor(@Inject(DB) private readonly db: Database) {
		super();
	}

	async save(input: NewEvent): Promise<SaveResult> {
		const { analysis } = input;
		const ts = input.timestamp.toISOString();

		try {
			return await this.db.transaction(async (tx) => {
				const [row] = await tx
					.insert(issue)
					.values({
						projectId: input.projectId,
						fingerprint: analysis.fingerprint,
						title: analysis.title,
						culprit: analysis.culprit,
						type: analysis.type,
						level: input.level,
						eventCount: 1,
						firstSeen: input.timestamp,
						lastSeen: input.timestamp,
					})
					.onConflictDoUpdate({
						target: [issue.projectId, issue.fingerprint],
						set: {
							eventCount: sql`${issue.eventCount} + 1`,
							firstSeen: sql`LEAST(${issue.firstSeen}, ${ts}::timestamptz)`,
							lastSeen: sql`GREATEST(${issue.lastSeen}, ${ts}::timestamptz)`,
							level: input.level,
							// Un issue resuelto que vuelve a ocurrir se reabre.
							// (La detección fina por release llega en la Fase 2.)
							status: sql`CASE WHEN ${issue.status} = 'resolved' THEN 'unresolved' ELSE ${issue.status} END`,
						},
					})
					.returning({
						id: issue.id,
						// xmax = 0 solo en filas recién insertadas (no actualizadas).
						isNew: sql<boolean>`(xmax = 0)`,
					});

				const inserted = await tx
					.insert(event)
					.values({
						id: input.id,
						projectId: input.projectId,
						issueId: row.id,
						timestamp: input.timestamp,
						receivedAt: input.receivedAt,
						level: input.level,
						type: analysis.type,
						message: input.message,
						release: input.release,
						environment: input.environment,
						platform: input.platform,
						userIdentifier: input.userIdentifier,
						payload: input.payload,
					})
					.onConflictDoNothing()
					.returning({ id: event.id });

				// Evento duplicado: deshacer el incremento del contador del issue.
				if (inserted.length === 0) tx.rollback();

				return {
					eventId: input.id,
					issueId: row.id,
					isNewIssue: row.isNew,
					duplicate: false,
				};
			});
		} catch (error) {
			if (error instanceof TransactionRollbackError) {
				return { eventId: input.id, isNewIssue: false, duplicate: true };
			}
			throw error;
		}
	}
}
