import { Injectable } from "@nestjs/common";
import type { IngestJobData } from "@sentinel/shared";
import { analyzeEvent, parseEventTimestamp } from "./domain/fingerprint.js";
import { EventRepository, type SaveResult } from "./event.repository.js";

@Injectable()
export class EventsService {
	constructor(private readonly events: EventRepository) {}

	/** Analiza el evento (fingerprint, título, timestamp) y lo delega al repositorio. */
	store(data: IngestJobData): Promise<SaveResult> {
		const { event: ev, client } = data;
		const receivedAt = new Date(data.receivedAt);

		return this.events.save({
			id: data.eventId,
			projectId: data.projectId,
			timestamp: parseEventTimestamp(ev.timestamp, receivedAt),
			receivedAt,
			analysis: analyzeEvent(ev),
			level: ev.level,
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
		});
	}
}
