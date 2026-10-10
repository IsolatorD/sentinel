import { Inject, Injectable } from "@nestjs/common";
import { type Database, perfSpan, perfTransaction } from "@sentinel/db";
import { DB } from "../database/database.module.js";
import {
	type NewTransaction,
	TransactionRepository,
} from "./transaction.repository.js";

// Cuántas filas de spans se insertan por sentencia (la transacción admite hasta 200).
const SPAN_BATCH = 100;

@Injectable()
export class DrizzleTransactionRepository extends TransactionRepository {
	constructor(@Inject(DB) private readonly db: Database) {
		super();
	}

	async save(input: NewTransaction): Promise<boolean> {
		return this.db.transaction(async (tx) => {
			const inserted = await tx
				.insert(perfTransaction)
				.values({
					id: input.id,
					projectId: input.projectId,
					traceId: input.traceId,
					spanId: input.spanId,
					parentSpanId: input.parentSpanId,
					name: input.name,
					op: input.op,
					status: input.status,
					timestamp: input.timestamp,
					receivedAt: input.receivedAt,
					durationMs: input.durationMs,
					release: input.release,
					environment: input.environment,
					platform: input.platform,
					userIdentifier: input.userIdentifier,
					measurements: input.measurements,
					tags: input.tags,
				})
				.onConflictDoNothing()
				.returning({ id: perfTransaction.id });
			// Ya estaba guardada: sus spans tampoco se duplican.
			if (inserted.length === 0) return false;

			for (let i = 0; i < input.spans.length; i += SPAN_BATCH) {
				await tx.insert(perfSpan).values(
					input.spans.slice(i, i + SPAN_BATCH).map((span) => ({
						transactionId: input.id,
						spanId: span.spanId,
						parentSpanId: span.parentSpanId,
						op: span.op,
						description: span.description,
						startTimestamp: span.startTimestamp,
						durationMs: span.durationMs,
						status: span.status,
						data: span.data,
					})),
				);
			}
			return true;
		});
	}
}
