import { Injectable } from "@nestjs/common";
import type { IngestEvent, IngestJobData } from "@sentinel/shared";
import { analyzeEvent, parseEventTimestamp } from "./domain/fingerprint.js";
import { EventRepository, type SaveResult } from "./event.repository.js";
import { SymbolicatorService } from "./symbolicator.service.js";

const TRACE_ID = /^[0-9a-f]{32}$/i;

/** El SDK pone `contexts.trace.trace_id` cuando captura durante una transacción; solo se acepta un id válido. */
function traceIdOf(contexts: IngestEvent["contexts"]): string | undefined {
	const id = contexts?.trace?.trace_id;
	return typeof id === "string" && TRACE_ID.test(id)
		? id.toLowerCase()
		: undefined;
}

@Injectable()
export class EventsService {
	constructor(
		private readonly events: EventRepository,
		private readonly symbolicator: SymbolicatorService,
	) {}

	/**
	 * Prepara el evento y lo delega al repositorio. El orden importa: primero se simboliza con los
	 * source maps y recién después se calcula el fingerprint, para que agrupe por el código original
	 * (el mismo error en dos builds distintos es un solo issue).
	 */
	async store(data: IngestJobData): Promise<SaveResult> {
		const { client } = data;
		const ev = await this.symbolicator.symbolicate(data.projectId, data.event);
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
			traceId: traceIdOf(ev.contexts),
			payload: { ...ev, _client: client },
		});
	}
}
