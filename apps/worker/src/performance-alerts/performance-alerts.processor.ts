import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { PERFORMANCE_ALERTS_QUEUE } from "@sentinel/shared";
import { PerformanceAlertsService } from "./performance-alerts.service.js";

@Processor(PERFORMANCE_ALERTS_QUEUE, { concurrency: 1 })
export class PerformanceAlertsProcessor extends WorkerHost {
	private readonly logger = new Logger(PerformanceAlertsProcessor.name);

	constructor(private readonly service: PerformanceAlertsService) {
		super();
	}

	async process(): Promise<void> {
		const sent = await this.service.run();
		if (sent > 0)
			this.logger.log(`${sent} aviso(s) de rendimiento encolado(s)`);
	}
}
