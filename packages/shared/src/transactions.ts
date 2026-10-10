import { z } from "zod";

export const TRANSACTIONS_QUEUE = "transactions";

// Límites defensivos: el endpoint de ingesta es público.
const short = z.string().max(256);
const medium = z.string().max(2_048);

/** Máximo de spans por transacción; el resto se descarta en el SDK. */
export const MAX_SPANS_PER_TRANSACTION = 200;

const hex = (length: number) =>
	z.string().regex(new RegExp(`^[0-9a-f]{${length}}$`, "i"));

/** Valor medido en la transacción, p. ej. un Web Vital (`lcp`, `cls`...). */
export const measurementSchema = z.object({
	value: z.number().finite(),
	unit: z.string().max(16).optional(),
});

/** Nombres de los Web Vitals que el panel interpreta; el SDK puede enviar otras medidas. */
export const WEB_VITALS = ["lcp", "cls", "inp", "fcp", "ttfb"] as const;
export type WebVital = (typeof WEB_VITALS)[number];

export const ingestSpanSchema = z.object({
	span_id: hex(16),
	parent_span_id: hex(16).optional(),
	// Qué tipo de trabajo es: "http.client", "db.query", "ui.render", "function"...
	op: short,
	description: medium.optional(),
	// ISO 8601 o epoch (segundos o milisegundos), como en los eventos.
	start_timestamp: z.union([z.string(), z.number()]),
	duration_ms: z.number().finite().nonnegative(),
	status: short.optional(),
	data: z.record(z.string().max(64), z.unknown()).optional(),
});
export type IngestSpan = z.infer<typeof ingestSpanSchema>;

export const ingestTransactionSchema = z.object({
	// UUID generado por el SDK (con o sin guiones); sirve para no duplicar reenvíos.
	transaction_id: z
		.string()
		.regex(
			/^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i,
		)
		.optional(),
	// Identifica la traza completa; la comparten el frontend y el backend que la atienden.
	trace_id: hex(32),
	// Span raíz de esta transacción.
	span_id: hex(16),
	parent_span_id: hex(16).optional(),
	// Qué se mide: la ruta ("/checkout"), "GET /api/orders", un job...
	name: medium.min(1),
	// "pageload", "navigation", "http.server", "task"...
	op: short.default("pageload"),
	timestamp: z.union([z.string(), z.number()]).optional(),
	duration_ms: z.number().finite().nonnegative(),
	// "ok" o el motivo del fallo ("error", "cancelled", "internal_error"...).
	status: short.default("ok"),
	platform: short.optional(),
	release: short.optional(),
	environment: short.optional(),
	user: z
		.object({
			id: short.optional(),
			email: short.optional(),
			username: short.optional(),
			ip_address: short.optional(),
		})
		.optional(),
	tags: z.record(z.string().max(64), z.string().max(512)).optional(),
	measurements: z.record(z.string().max(32), measurementSchema).optional(),
	spans: z.array(ingestSpanSchema).max(MAX_SPANS_PER_TRANSACTION).default([]),
});
export type IngestTransaction = z.infer<typeof ingestTransactionSchema>;

// Datos del job que la API encola y el worker procesa.
export interface TransactionJobData {
	projectId: string;
	transactionId: string;
	receivedAt: string;
	transaction: IngestTransaction;
	client: { ip?: string; userAgent?: string };
}
