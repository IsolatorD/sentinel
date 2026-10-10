import type { SentinelSpan, SentinelTransaction } from "../types";
import { uuid } from "../uuid";
import type { Span } from "./span";
import type { Transaction } from "./transaction";

const MAX_TEXT = 2_000;
const clip = (text: string, max = MAX_TEXT) =>
	text.length > max ? text.slice(0, max) : text;

/** Solo valores simples: el contrato acepta cualquier cosa, pero aquí no hay motivo para enviar objetos grandes. */
function cleanData(
	data: Record<string, unknown>,
): Record<string, unknown> | undefined {
	const out: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(data)) {
		if (typeof value === "string") out[clip(key, 64)] = clip(value, 512);
		else if (typeof value === "number" || typeof value === "boolean")
			out[clip(key, 64)] = value;
	}
	return Object.keys(out).length > 0 ? out : undefined;
}

function spanPayload(span: Span): SentinelSpan {
	const data = cleanData(span.data);
	return {
		span_id: span.spanId,
		parent_span_id: span.parentSpanId || undefined,
		op: clip(span.op, 255),
		...(span.description && { description: clip(span.description) }),
		start_timestamp: new Date(span.startMs).toISOString(),
		duration_ms: Math.max(0, (span.endMs ?? span.startMs) - span.startMs),
		...(span.status && { status: clip(span.status, 255) }),
		...(data && { data }),
	};
}

/** Datos que no son de la transacción sino del cliente (release, usuario...). */
export interface PayloadContext {
	release?: string;
	environment?: string;
	user?: SentinelTransaction["user"];
	tags?: Record<string, string>;
}

export function transactionPayload(
	tx: Transaction,
	context: PayloadContext,
): SentinelTransaction {
	const tags = { ...context.tags, ...tx.tags };
	return {
		transaction_id: uuid(),
		trace_id: tx.traceId,
		span_id: tx.spanId,
		name: clip(tx.name) || "/",
		op: clip(tx.op, 255),
		timestamp: new Date(tx.startMs).toISOString(),
		duration_ms: Math.max(0, tx.durationMs),
		status: clip(tx.status, 255),
		platform: "javascript",
		release: context.release,
		environment: context.environment,
		...(context.user &&
			Object.keys(context.user).length > 0 && { user: context.user }),
		...(Object.keys(tags).length > 0 && { tags }),
		...(Object.keys(tx.measurements).length > 0 && {
			measurements: tx.measurements,
		}),
		spans: tx.spans.map(spanPayload),
	};
}
