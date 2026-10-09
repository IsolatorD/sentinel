import { Inject, Injectable } from "@nestjs/common";
import {
	type Database,
	event,
	issue,
	sql,
	TransactionRollbackError,
} from "@sentinel/db";
import type { IngestJobData } from "@sentinel/shared";
import { DB } from "../database/database.module.js";
import { analyzeEvent, parseEventTimestamp } from "./fingerprint.js";

export interface StoreResult {
	eventId: string;
	issueId?: string;
	isNewIssue: boolean;
	duplicate: boolean;
}

@Injectable()
export class EventsService {
	constructor(@Inject(DB) private readonly db: Database) {}

	/**
	 * Agrupa el evento en un issue (lo crea si no existe) y guarda el evento.
	 * Es idempotente: si el job se reintenta y el evento ya estaba guardado,
	 * se deshace el incremento del contador y se devuelve `duplicate: true`.
	 */
	async store(data: IngestJobData): Promise<StoreResult> {
		const { projectId, eventId, client } = data;
		const ev = data.event;
		const receivedAt = new Date(data.receivedAt);
		const timestamp = parseEventTimestamp(ev.timestamp, receivedAt);
		const analysis = analyzeEvent(ev);
		const ts = timestamp.toISOString();

		try {
			return await this.db.transaction(async (tx) => {
				const [row] = await tx
					.insert(issue)
					.values({
						projectId,
						fingerprint: analysis.fingerprint,
						title: analysis.title,
						culprit: analysis.culprit,
						type: analysis.type,
						level: ev.level,
						eventCount: 1,
						firstSeen: timestamp,
						lastSeen: timestamp,
					})
					.onConflictDoUpdate({
						target: [issue.projectId, issue.fingerprint],
						set: {
							eventCount: sql`${issue.eventCount} + 1`,
							firstSeen: sql`LEAST(${issue.firstSeen}, ${ts}::timestamptz)`,
							lastSeen: sql`GREATEST(${issue.lastSeen}, ${ts}::timestamptz)`,
							level: ev.level,
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
						id: eventId,
						projectId,
						issueId: row.id,
						timestamp,
						receivedAt,
						level: ev.level,
						type: analysis.type,
						message: ev.message ?? ev.exception?.values.at(-1)?.value,
						release: ev.release,
						environment: ev.environment,
						platform: ev.platform,
						userIdentifier:
							ev.user?.id ??
							ev.user?.email ??
							ev.user?.username ??
							ev.user?.ip_address ??
							client.ip,
						payload: { ...ev, _client: client },
					})
					.onConflictDoNothing()
					.returning({ id: event.id });

				if (inserted.length === 0) tx.rollback();

				return {
					eventId,
					issueId: row.id,
					isNewIssue: row.isNew,
					duplicate: false,
				};
			});
		} catch (error) {
			if (error instanceof TransactionRollbackError) {
				return { eventId, isNewIssue: false, duplicate: true };
			}
			throw error;
		}
	}
}
