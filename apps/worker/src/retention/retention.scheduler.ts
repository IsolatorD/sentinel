import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { MAINTENANCE_QUEUE, RETENTION_JOB } from "@sentinel/shared";
import type { Queue } from "bullmq";
import type { WorkerEnv } from "../config/env.js";

/** Registra (o actualiza) la repetición diaria de la retención al arrancar el worker. */
@Injectable()
export class RetentionScheduler implements OnModuleInit {
	private readonly logger = new Logger(RetentionScheduler.name);

	constructor(
		@InjectQueue(MAINTENANCE_QUEUE) private readonly queue: Queue,
		private readonly config: ConfigService<WorkerEnv, true>,
	) {}

	async onModuleInit(): Promise<void> {
		const enabled = this.config.get("RETENTION_ENABLED", { infer: true });
		const pattern = this.config.get("RETENTION_CRON", { infer: true });
		if (!enabled) {
			// Si antes estaba activada, se quita la repetición que quedó guardada en Redis.
			await this.queue.removeJobScheduler(RETENTION_JOB);
			this.logger.log("retención desactivada (RETENTION_ENABLED=false)");
			return;
		}
		await this.queue.upsertJobScheduler(
			RETENTION_JOB,
			{ pattern },
			{
				name: RETENTION_JOB,
				opts: { removeOnComplete: { count: 10 }, removeOnFail: { count: 20 } },
			},
		);
		this.logger.log(`retención programada: ${pattern}`);
	}
}
