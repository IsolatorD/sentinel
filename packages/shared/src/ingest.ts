import { z } from "zod";

export const EVENTS_QUEUE = "events";

export const LEVELS = ["fatal", "error", "warning", "info", "debug"] as const;
export const levelSchema = z.enum(LEVELS);
export type Level = z.infer<typeof levelSchema>;

// Límites defensivos: el endpoint de ingesta es público.
const short = z.string().max(256);
const medium = z.string().max(2_048);
const long = z.string().max(16_384);

export const stackFrameSchema = z.object({
	filename: medium.optional(),
	function: short.optional(),
	module: short.optional(),
	lineno: z.number().int().nonnegative().optional(),
	colno: z.number().int().nonnegative().optional(),
	in_app: z.boolean().optional(),
});
export type StackFrame = z.infer<typeof stackFrameSchema>;

export const exceptionValueSchema = z.object({
	type: short,
	value: long.optional(),
	// Orden: del frame más antiguo al más reciente (el último es donde se lanzó).
	stacktrace: z
		.object({ frames: z.array(stackFrameSchema).max(250) })
		.optional(),
});
export type ExceptionValue = z.infer<typeof exceptionValueSchema>;

export const breadcrumbSchema = z.object({
	timestamp: z.union([z.string(), z.number()]).optional(),
	category: short.optional(),
	type: short.optional(),
	level: levelSchema.optional(),
	message: medium.optional(),
	data: z.record(z.string(), z.unknown()).optional(),
});

export const ingestEventSchema = z.object({
	// Identificador generado por el SDK (UUID, con o sin guiones).
	event_id: z
		.string()
		.regex(
			/^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i,
		)
		.optional(),
	// ISO 8601 o epoch (segundos o milisegundos).
	timestamp: z.union([z.string(), z.number()]).optional(),
	level: levelSchema.default("error"),
	platform: short.optional(),
	release: short.optional(),
	environment: short.optional(),
	message: long.optional(),
	exception: z
		.object({ values: z.array(exceptionValueSchema).min(1).max(10) })
		.optional(),
	// Si se envía, reemplaza al fingerprint automático.
	fingerprint: z.array(short).min(1).max(10).optional(),
	user: z
		.object({
			id: short.optional(),
			email: short.optional(),
			username: short.optional(),
			ip_address: short.optional(),
		})
		.optional(),
	tags: z.record(z.string().max(64), z.string().max(512)).optional(),
	request: z
		.object({
			url: medium.optional(),
			method: z.string().max(16).optional(),
			headers: z.record(z.string(), z.string().max(1_024)).optional(),
		})
		.optional(),
	contexts: z.record(z.string(), z.record(z.string(), z.unknown())).optional(),
	breadcrumbs: z.array(breadcrumbSchema).max(100).optional(),
	extra: z.record(z.string(), z.unknown()).optional(),
});
export type IngestEvent = z.infer<typeof ingestEventSchema>;

export const ingestResponseSchema = z.object({ id: z.string().uuid() });
export type IngestResponse = z.infer<typeof ingestResponseSchema>;

// Datos del job que la API encola y el worker procesa.
export interface IngestJobData {
	projectId: string;
	eventId: string;
	receivedAt: string;
	event: IngestEvent;
	client: { ip?: string; userAgent?: string };
}
