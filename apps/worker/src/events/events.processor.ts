import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { EVENTS_QUEUE, type IngestJobData } from "@sentinel/shared";
import type { Job } from "bullmq";
import { AlertsService } from "../alerts/alerts.service.js";
import { EventsService } from "./events.service.js";

@Processor(EVENTS_QUEUE, { concurrency: 5 })
export class EventsProcessor extends WorkerHost {
	private readonly logger = new Logger(EventsProcessor.name);

	constructor(
		private readonly events: EventsService,
		private readonly alerts: AlertsService,
	) {
		super();
	}

	async process(job: Job<IngestJobData>): Promise<void> {
		const result = await this.events.store(job.data);
		this.logger.log(
			result.duplicate
				? `evento ${result.eventId} duplicado, ignorado`
				: `evento ${result.eventId} -> issue ${result.issueId}${result.isNewIssue ? " (nuevo)" : ""}`,
		);
		await this.alerts.onEventStored(result, {
			projectId: job.data.projectId,
			isNewIssue: result.isNewIssue,
			regressed: result.regressed,
			level: job.data.event.level,
			environment: job.data.event.environment,
			release: job.data.event.release,
		});
	}
}
