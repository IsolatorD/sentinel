import type { IngestSpan } from "@sentinel/shared";

export interface NewSpan {
	spanId: string;
	parentSpanId?: string;
	op: string;
	description?: string;
	startTimestamp: Date;
	durationMs: number;
	status?: string;
	data?: Record<string, unknown>;
}

/** Transacción ya normalizada, lista para persistir junto con sus spans. */
export interface NewTransaction {
	id: string;
	projectId: string;
	traceId: string;
	spanId: string;
	parentSpanId?: string;
	name: string;
	op: string;
	status: string;
	timestamp: Date;
	receivedAt: Date;
	durationMs: number;
	release?: string;
	environment?: string;
	platform?: string;
	userIdentifier?: string;
	measurements: Record<string, { value: number; unit?: string }>;
	tags: Record<string, string>;
	spans: NewSpan[];
}

export type { IngestSpan };

/** Puerto de persistencia de transacciones (hoy Postgres; podría ser un almacén columnar). */
export abstract class TransactionRepository {
	/** Guarda la transacción y sus spans de forma atómica. Devuelve `false` si ya existía (reintento). */
	abstract save(transaction: NewTransaction): Promise<boolean>;
}
