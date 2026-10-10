import { Processor, WorkerHost } from "@nestjs/bullmq";
import { MAINTENANCE_QUEUE } from "@sentinel/shared";
import { RetentionService } from "./retention.service.js";

@Processor(MAINTENANCE_QUEUE, { concurrency: 1 })
export class RetentionProcessor extends WorkerHost {
	constructor(private readonly retention: RetentionService) {
		super();
	}

	async process(): Promise<void> {
		await this.retention.run();
	}
}
