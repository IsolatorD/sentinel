import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import type { Job } from "bullmq";

export const EVENTS_QUEUE = "events";

// Placeholder: en la Fase 1 aquí se hará fingerprint, agrupación y alertas.
@Processor(EVENTS_QUEUE)
export class EventsProcessor extends WorkerHost {
	private readonly logger = new Logger(EventsProcessor.name);

	async process(job: Job): Promise<void> {
		this.logger.log(`Procesando job ${job.id} (${job.name})`);
	}
}
