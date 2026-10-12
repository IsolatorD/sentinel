import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
	PERFORMANCE_ALERTS_JOB,
	PERFORMANCE_ALERTS_QUEUE,
} from "@sentinel/shared";
import type { Queue } from "bullmq";
import type { WorkerEnv } from "../config/env.js";

/** Registra (o actualiza) la repetición de la evaluación de reglas de rendimiento al arrancar el worker. */
@Injectable()
export class PerformanceAlertsScheduler implements OnModuleInit {
	private readonly logger = new Logger(PerformanceAlertsScheduler.name);

	constructor(
		@InjectQueue(PERFORMANCE_ALERTS_QUEUE) private readonly queue: Queue,
		private readonly config: ConfigService<WorkerEnv, true>,
	) {}

	async onModuleInit(): Promise<void> {
		const enabled = this.config.get("PERFORMANCE_ALERTS_ENABLED", {
			infer: true,
		});
		const pattern = this.config.get("PERFORMANCE_ALERTS_CRON", { infer: true });
		if (!enabled) {
			// Si antes estaba activada, se quita la repetición que quedó guardada en Redis.
			await this.queue.removeJobScheduler(PERFORMANCE_ALERTS_JOB);
			this.logger.log(
				"alertas de rendimiento desactivadas (PERFORMANCE_ALERTS_ENABLED=false)",
			);
			return;
		}
		await this.queue.upsertJobScheduler(
			PERFORMANCE_ALERTS_JOB,
			{ pattern },
			{
				name: PERFORMANCE_ALERTS_JOB,
				opts: { removeOnComplete: { count: 5 }, removeOnFail: { count: 20 } },
			},
		);
		this.logger.log(`alertas de rendimiento programadas: ${pattern}`);
	}
}
