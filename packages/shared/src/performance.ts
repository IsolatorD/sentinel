import { z } from "zod";
import { paginated } from "./issues.js";
import { statsPeriodSchema } from "./stats.js";
import { WEB_VITALS, type WebVital } from "./transactions.js";

// ---------- Web Vitals: umbrales de Google (bueno / necesita mejorar / malo) ----------

export const VITAL_RATINGS = ["good", "needs-improvement", "poor"] as const;
export type VitalRating = (typeof VITAL_RATINGS)[number];

/** Hasta `good` es bueno; por encima de `poor` es malo. LCP, INP, FCP y TTFB en ms; CLS sin unidad. */
export const VITAL_THRESHOLDS: Record<
	WebVital,
	{ good: number; poor: number }
> = {
	lcp: { good: 2_500, poor: 4_000 },
	cls: { good: 0.1, poor: 0.25 },
	inp: { good: 200, poor: 500 },
	fcp: { good: 1_800, poor: 3_000 },
	ttfb: { good: 800, poor: 1_800 },
};

export function rateVital(vital: WebVital, value: number): VitalRating {
	const t = VITAL_THRESHOLDS[vital];
	if (value <= t.good) return "good";
	return value <= t.poor ? "needs-improvement" : "poor";
}

// ---------- Consultas ----------

const text = z.string().trim().min(1).max(256);

export const performanceFilterSchema = z.object({
	period: statsPeriodSchema.default("24h"),
	environment: text.optional(),
	release: text.optional(),
});

export const TRANSACTION_SORTS = [
	"count",
	"p50",
	"p95",
	"errorRate",
	"tpm",
	"lastSeen",
] as const;

export const listTransactionsQuerySchema = performanceFilterSchema.extend({
	/** Busca en el nombre de la transacción. */
	q: text.optional(),
	sort: z.enum(TRANSACTION_SORTS).default("count"),
	order: z.enum(["asc", "desc"]).default("desc"),
	limit: z.coerce.number().int().min(1).max(100).default(25),
	offset: z.coerce.number().int().min(0).default(0),
});
export type ListTransactionsQuery = z.infer<typeof listTransactionsQuerySchema>;

export const overviewQuerySchema = performanceFilterSchema.extend({
	/** Si se indica, el resumen es solo de esa transacción. */
	name: text.optional(),
});
export type OverviewQuery = z.infer<typeof overviewQuerySchema>;

export const listSamplesQuerySchema = performanceFilterSchema.extend({
	name: text,
	sort: z.enum(["slowest", "recent"]).default("slowest"),
	limit: z.coerce.number().int().min(1).max(50).default(10),
});
export type ListSamplesQuery = z.infer<typeof listSamplesQuerySchema>;

// ---------- Respuestas ----------

/** Percentil que puede faltar cuando no hubo transacciones. */
const duration = z.number().nullable();

export const transactionGroupDtoSchema = z.object({
	name: z.string(),
	op: z.string(),
	count: z.number().int(),
	p50: duration,
	p95: duration,
	p99: duration,
	/** Fracción (0–1) de transacciones que no terminaron con estado `ok`. */
	errorRate: z.number(),
	/** Transacciones por minuto, promediadas sobre todo el periodo. */
	tpm: z.number(),
	lastSeen: z.string().datetime(),
});
export type TransactionGroupDto = z.infer<typeof transactionGroupDtoSchema>;

export const transactionListDtoSchema = paginated(transactionGroupDtoSchema);
export type TransactionListDto = z.infer<typeof transactionListDtoSchema>;

export const performanceSummarySchema = z.object({
	count: z.number().int(),
	p50: duration,
	p95: duration,
	p99: duration,
	errorRate: z.number(),
	tpm: z.number(),
});

export const vitalSummarySchema = z.object({
	/** Percentil 75, el que se usa para valorar un Web Vital. */
	p75: z.number(),
	samples: z.number().int(),
	rating: z.enum(VITAL_RATINGS),
});

export const performancePointSchema = z.object({
	start: z.string().datetime(),
	count: z.number().int(),
	errors: z.number().int(),
	p50: duration,
	p95: duration,
});

export const performanceOverviewDtoSchema = z.object({
	period: statsPeriodSchema,
	bucketMinutes: z.number().int(),
	from: z.string().datetime(),
	to: z.string().datetime(),
	summary: performanceSummarySchema,
	/** Solo los Web Vitals que se llegaron a medir. */
	vitals: z.partialRecord(z.enum(WEB_VITALS), vitalSummarySchema),
	/** Serie continua: los intervalos sin transacciones traen `count: 0` y percentiles nulos. */
	points: z.array(performancePointSchema),
});
export type PerformanceOverviewDto = z.infer<
	typeof performanceOverviewDtoSchema
>;

export const sampleDtoSchema = z.object({
	id: z.string().uuid(),
	traceId: z.string(),
	timestamp: z.string().datetime(),
	durationMs: z.number(),
	status: z.string(),
	release: z.string().nullable(),
	environment: z.string().nullable(),
	user: z.string().nullable(),
});
export type SampleDto = z.infer<typeof sampleDtoSchema>;

export const sampleListDtoSchema = z.object({
	items: z.array(sampleDtoSchema),
});
export type SampleListDto = z.infer<typeof sampleListDtoSchema>;

export const waterfallSpanSchema = z.object({
	spanId: z.string(),
	parentSpanId: z.string().nullable(),
	op: z.string(),
	description: z.string().nullable(),
	/** Milisegundos desde el inicio de la transacción. */
	offsetMs: z.number(),
	durationMs: z.number(),
	status: z.string().nullable(),
	/** Nivel de anidación (1 = hijo directo de la transacción). */
	depth: z.number().int(),
	data: z.record(z.string(), z.unknown()).nullable(),
});
export type WaterfallSpan = z.infer<typeof waterfallSpanSchema>;

export const sampleDetailDtoSchema = sampleDtoSchema.extend({
	name: z.string(),
	op: z.string(),
	spanId: z.string(),
	platform: z.string().nullable(),
	measurements: z.record(
		z.string(),
		z.object({ value: z.number(), unit: z.string().optional() }),
	),
	tags: z.record(z.string(), z.string()),
	/** Ordenados por inicio, listos para dibujar la cascada. */
	spans: z.array(waterfallSpanSchema),
});
export type SampleDetailDto = z.infer<typeof sampleDetailDtoSchema>;

// ---------- Traza completa (una petición que cruza varios servicios) ----------

export const traceTransactionSchema = z.object({
	id: z.string().uuid(),
	name: z.string(),
	op: z.string(),
	status: z.string(),
	platform: z.string().nullable(),
	timestamp: z.string().datetime(),
	durationMs: z.number(),
	spanId: z.string(),
	/** Span del servicio que la originó (la transacción del navegador que hizo la petición). */
	parentSpanId: z.string().nullable(),
	/** La transacción de esta traza a la que pertenece ese span (para anidarlas), si se conoce. */
	parentTransactionId: z.string().uuid().nullable(),
	release: z.string().nullable(),
	environment: z.string().nullable(),
});
export type TraceTransaction = z.infer<typeof traceTransactionSchema>;

/** Un error ocurrido durante la traza. */
export const traceEventSchema = z.object({
	id: z.string().uuid(),
	issueId: z.string().uuid(),
	issueTitle: z.string(),
	level: z.string(),
	timestamp: z.string().datetime(),
	platform: z.string().nullable(),
	/** Span de la transacción en curso cuando se capturó, si el SDK lo envió. */
	spanId: z.string().nullable(),
});
export type TraceEvent = z.infer<typeof traceEventSchema>;

export const traceDtoSchema = z.object({
	traceId: z.string(),
	/** Ordenadas por inicio. */
	transactions: z.array(traceTransactionSchema),
	/** Errores capturados durante la traza, ordenados por fecha. */
	events: z.array(traceEventSchema),
});
export type TraceDto = z.infer<typeof traceDtoSchema>;

export const TRACE_ID_PATTERN = /^[0-9a-f]{32}$/i;

/** Parámetro de ruta `:traceId`. */
export const traceIdParamSchema = z.string().regex(TRACE_ID_PATTERN);
