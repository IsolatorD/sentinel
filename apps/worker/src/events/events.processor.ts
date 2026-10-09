import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { EVENTS_QUEUE, type IngestJobData } from "@sentinel/shared";
import type { Job } from "bullmq";
import { EventsService } from "./events.service.js";

@Processor(EVENTS_QUEUE, { concurrency: 5 })
export class EventsProcessor extends WorkerHost {
	private readonly logger = new Logger(EventsProcessor.name);

	constructor(private readonly events: EventsService) {
		super();
	}

	async process(job: Job<IngestJobData>): Promise<void> {
		const result = await this.events.store(job.data);
		this.logger.log(
			result.duplicate
				? `evento ${result.eventId} duplicado, ignorado`
				: `evento ${result.eventId} -> issue ${result.issueId}${result.isNewIssue ? " (nuevo)" : ""}`,
		);
		// Fase 3: aquí se evaluarán las reglas de alerta (issue nuevo, regresión, umbral).
	}
}
