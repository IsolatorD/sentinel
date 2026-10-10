import { z } from "zod";
import { ISSUE_STATUSES } from "./issues.js";
import { statsPeriodSchema } from "./stats.js";

export const dashboardQuerySchema = z.object({
	period: statsPeriodSchema.default("7d"),
	environment: z.string().trim().min(1).max(256).optional(),
});
export type DashboardQuery = z.infer<typeof dashboardQuerySchema>;

/** Un reparto: cuántos eventos hay de cada nivel, entorno o release. */
const breakdownSchema = z.array(
	z.object({ key: z.string(), count: z.number().int() }),
);

export const dashboardDtoSchema = z.object({
	period: statsPeriodSchema,
	bucketMinutes: z.number().int(),
	from: z.string().datetime(),
	to: z.string().datetime(),
	totals: z.object({
		events: z.number().int(),
		/** Usuarios distintos afectados por algún error. */
		users: z.number().int(),
		newIssues: z.number().int(),
		resolvedIssues: z.number().int(),
		transactions: z.number().int(),
		/** p95 de la duración de las transacciones, o `null` si no hubo. */
		p95: z.number().nullable(),
		/** Fracción (0–1) de transacciones que no terminaron bien. */
		errorRate: z.number(),
	}),
	/** Los mismos conteos del periodo anterior, de igual duración, para ver si sube o baja. */
	previous: z.object({
		events: z.number().int(),
		newIssues: z.number().int(),
		transactions: z.number().int(),
	}),
	/** Serie continua: los intervalos vacíos traen ceros. */
	series: z.array(
		z.object({
			start: z.string().datetime(),
			events: z.number().int(),
			newIssues: z.number().int(),
			transactions: z.number().int(),
		}),
	),
	byLevel: breakdownSchema,
	byEnvironment: breakdownSchema,
	byRelease: breakdownSchema,
	topIssues: z.array(
		z.object({
			id: z.string().uuid(),
			title: z.string(),
			level: z.string(),
			status: z.enum(ISSUE_STATUSES),
			events: z.number().int(),
			users: z.number().int(),
		}),
	),
	slowest: z.array(
		z.object({
			name: z.string(),
			op: z.string(),
			count: z.number().int(),
			p95: z.number(),
		}),
	),
});
export type DashboardDto = z.infer<typeof dashboardDtoSchema>;
