import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { TRANSACTIONS_QUEUE } from "@sentinel/shared";
import { DrizzleTransactionRepository } from "./drizzle-transaction.repository.js";
import { TransactionRepository } from "./transaction.repository.js";
import { TransactionsProcessor } from "./transactions.processor.js";
import { TransactionsService } from "./transactions.service.js";

@Module({
	imports: [BullModule.registerQueue({ name: TRANSACTIONS_QUEUE })],
	providers: [
		TransactionsProcessor,
		TransactionsService,
		{ provide: TransactionRepository, useClass: DrizzleTransactionRepository },
	],
})
export class TransactionsModule {}
