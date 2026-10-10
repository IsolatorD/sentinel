import { randomUUID } from "node:crypto";
import { InjectQueue } from "@nestjs/bullmq";
import { Injectable } from "@nestjs/common";
import {
	type IngestTransaction,
	scrubEvent,
	TRANSACTIONS_QUEUE,
	type TransactionJobData,
} from "@sentinel/shared";
import type { Queue } from "bullmq";
import { QuotaService } from "../quota/quota.service.js";
import { normalizeEventId } from "./ingest.service.js";

@Injectable()
export class TransactionsService {
	constructor(
		@InjectQueue(TRANSACTIONS_QUEUE)
		private readonly queue: Queue<TransactionJobData>,
		private readonly quota: QuotaService,
	) {}

	async enqueue(
		projectId: string,
		transaction: IngestTransaction,
		client: TransactionJobData["client"],
	): Promise<string> {
		const transactionId =
			normalizeEventId(transaction.transaction_id) ?? randomUUID();

		await this.queue.add(
			"ingest",
			{
				projectId,
				transactionId,
				receivedAt: new Date().toISOString(),
				// Igual que con los eventos: los secretos (p. ej. tokens en la URL de un span) salen aquí.
				transaction: scrubEvent(transaction),
				client,
			},
			{
				jobId: `${projectId}_${transactionId}`,
				attempts: 3,
				backoff: { type: "exponential", delay: 2_000 },
				removeOnComplete: { age: 3_600, count: 1_000 },
				removeOnFail: { age: 7 * 24 * 3_600 },
			},
		);
		await this.quota.record(projectId, "transactions");
		return transactionId;
	}
}
