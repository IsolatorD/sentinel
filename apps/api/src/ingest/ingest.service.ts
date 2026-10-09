import { randomUUID } from "node:crypto";
import { InjectQueue } from "@nestjs/bullmq";
import { Injectable } from "@nestjs/common";
import {
	EVENTS_QUEUE,
	type IngestEvent,
	type IngestJobData,
} from "@sentinel/shared";
import type { Queue } from "bullmq";

// Acepta UUID con o sin guiones y lo devuelve en formato canónico.
function normalizeEventId(raw: string | undefined): string | undefined {
	if (!raw) return undefined;
	const hex = raw.replace(/-/g, "").toLowerCase();
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

@Injectable()
export class IngestService {
	constructor(
		@InjectQueue(EVENTS_QUEUE) private readonly queue: Queue<IngestJobData>,
	) {}

	async enqueue(
		projectId: string,
		event: IngestEvent,
		client: IngestJobData["client"],
	): Promise<string> {
		const eventId = normalizeEventId(event.event_id) ?? randomUUID();

		await this.queue.add(
			"ingest",
			{
				projectId,
				eventId,
				receivedAt: new Date().toISOString(),
				event,
				client,
			},
			{
				// Mismo evento reenviado mientras el job existe => no se duplica.
				jobId: `${projectId}_${eventId}`,
				attempts: 3,
				backoff: { type: "exponential", delay: 2_000 },
				removeOnComplete: { age: 3_600, count: 1_000 },
				removeOnFail: { age: 7 * 24 * 3_600 },
			},
		);
		return eventId;
	}
}
