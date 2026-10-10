import { Injectable } from "@nestjs/common";
import type { TransactionJobData } from "@sentinel/shared";
import { parseEventTimestamp } from "../events/domain/fingerprint.js";
import { TransactionRepository } from "./transaction.repository.js";

@Injectable()
export class TransactionsService {
	constructor(private readonly transactions: TransactionRepository) {}

	/** Normaliza las fechas (ISO o epoch) y guarda. Devuelve `false` si era un reenvío ya guardado. */
	async store(data: TransactionJobData): Promise<boolean> {
		const { transaction: tx, client } = data;
		const receivedAt = new Date(data.receivedAt);
		const timestamp = parseEventTimestamp(tx.timestamp, receivedAt);

		return this.transactions.save({
			id: data.transactionId,
			projectId: data.projectId,
			traceId: tx.trace_id.toLowerCase(),
			spanId: tx.span_id.toLowerCase(),
			parentSpanId: tx.parent_span_id?.toLowerCase(),
			name: tx.name,
			op: tx.op,
			status: tx.status,
			timestamp,
			receivedAt,
			durationMs: tx.duration_ms,
			release: tx.release,
			environment: tx.environment,
			platform: tx.platform,
			userIdentifier:
				tx.user?.id ??
				tx.user?.email ??
				tx.user?.username ??
				tx.user?.ip_address ??
				client.ip,
			measurements: tx.measurements ?? {},
			tags: tx.tags ?? {},
			spans: tx.spans.map((span) => ({
				spanId: span.span_id.toLowerCase(),
				parentSpanId: span.parent_span_id?.toLowerCase(),
				op: span.op,
				description: span.description,
				// Un span sin fecha válida arranca con la transacción.
				startTimestamp: parseEventTimestamp(span.start_timestamp, timestamp),
				durationMs: span.duration_ms,
				status: span.status,
				data: span.data,
			})),
		});
	}
}
