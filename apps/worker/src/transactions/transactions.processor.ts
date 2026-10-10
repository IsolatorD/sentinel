import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { TRANSACTIONS_QUEUE, type TransactionJobData } from "@sentinel/shared";
import type { Job } from "bullmq";
import { TransactionsService } from "./transactions.service.js";

@Processor(TRANSACTIONS_QUEUE, { concurrency: 5 })
export class TransactionsProcessor extends WorkerHost {
	private readonly logger = new Logger(TransactionsProcessor.name);

	constructor(private readonly transactions: TransactionsService) {
		super();
	}

	async process(job: Job<TransactionJobData>): Promise<void> {
		const saved = await this.transactions.store(job.data);
		this.logger.log(
			saved
				? `transacción ${job.data.transactionId} guardada (${job.data.transaction.spans.length} spans)`
				: `transacción ${job.data.transactionId} duplicada, ignorada`,
		);
	}
}
