import { z } from "zod";

/** Ventanas de tiempo de los gráficos y el tamaño del intervalo con el que se agrupan los eventos. */
export const STATS_PERIODS = ["24h", "7d", "30d"] as const;
export const statsPeriodSchema = z.enum(STATS_PERIODS);
export type StatsPeriod = z.infer<typeof statsPeriodSchema>;

export const PERIOD_CONFIG: Record<
	StatsPeriod,
	{ hours: number; bucketHours: number }
> = {
	"24h": { hours: 24, bucketHours: 1 },
	"7d": { hours: 7 * 24, bucketHours: 6 },
	"30d": { hours: 30 * 24, bucketHours: 24 },
};

export const statsQuerySchema = z.object({
	period: statsPeriodSchema.default("24h"),
});
export type StatsQuery = z.infer<typeof statsQuerySchema>;

export const statsPointSchema = z.object({
	/** Inicio del intervalo (UTC). */
	start: z.string().datetime(),
	events: z.number().int(),
	/** Usuarios distintos afectados en el intervalo. */
	users: z.number().int(),
});

export const statsDtoSchema = z.object({
	period: statsPeriodSchema,
	bucketMinutes: z.number().int(),
	from: z.string().datetime(),
	to: z.string().datetime(),
	/** Eventos de toda la ventana. */
	totalEvents: z.number().int(),
	/** Todos los intervalos de la ventana, también los vacíos: la serie es continua. */
	points: z.array(statsPointSchema),
});
export type StatsDto = z.infer<typeof statsDtoSchema>;
