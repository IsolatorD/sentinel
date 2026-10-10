import {
	ISSUE_SORTS,
	ISSUE_STATUSES,
	levelSchema,
	STATS_PERIODS,
	TRANSACTION_SORTS,
} from "@sentinel/shared";
import { z } from "zod";

export const PAGE_SIZE = 25;

// La URL es la fuente de verdad del estado de la pantalla. Se valida en dos capas:
//  1. `*SearchInputSchema`: lo que acepta el router. Todo es opcional (los enlaces no tienen que
//     indicar nada) y `.catch(undefined)` descarta valores inválidos en vez de romper la pantalla.
//  2. `resolve*Search`: rellena los valores por defecto al leer.

export const issuesSearchInputSchema = z.object({
	status: z
		.enum([...ISSUE_STATUSES, "all"])
		.optional()
		.catch(undefined),
	q: z.string().trim().min(1).max(200).optional().catch(undefined),
	level: levelSchema.optional().catch(undefined),
	environment: z.string().trim().min(1).max(256).optional().catch(undefined),
	release: z.string().trim().min(1).max(256).optional().catch(undefined),
	/** `me`, `unassigned` o el id de un usuario. */
	assignee: z.string().trim().min(1).max(64).optional().catch(undefined),
	sort: z.enum(ISSUE_SORTS).optional().catch(undefined),
	order: z.enum(["asc", "desc"]).optional().catch(undefined),
	page: z.coerce.number().int().min(1).optional().catch(undefined),
});

export const ISSUES_SEARCH_DEFAULTS = {
	status: "unresolved",
	sort: "lastSeen",
	order: "desc",
	page: 1,
} as const;

export const issueSearchInputSchema = z.object({
	/** Evento seleccionado; sin él se muestra el último. */
	event: z.string().uuid().optional().catch(undefined),
	tab: z.enum(["details", "events", "activity"]).optional().catch(undefined),
});

export const ALERT_TABS = ["rules", "channels", "history"] as const;

export const alertsSearchInputSchema = z.object({
	tab: z.enum(ALERT_TABS).optional().catch(undefined),
	page: z.coerce.number().int().min(1).optional().catch(undefined),
});

export const ALERTS_SEARCH_DEFAULTS = { tab: "rules", page: 1 } as const;

const periodInput = z.enum(STATS_PERIODS).optional().catch(undefined);
const filterInput = z
	.string()
	.trim()
	.min(1)
	.max(256)
	.optional()
	.catch(undefined);

/** Lista de transacciones de la pantalla de rendimiento. */
export const performanceSearchInputSchema = z.object({
	period: periodInput,
	environment: filterInput,
	release: filterInput,
	q: z.string().trim().min(1).max(200).optional().catch(undefined),
	sort: z.enum(TRANSACTION_SORTS).optional().catch(undefined),
	order: z.enum(["asc", "desc"]).optional().catch(undefined),
	page: z.coerce.number().int().min(1).optional().catch(undefined),
});

export const PERFORMANCE_SEARCH_DEFAULTS = {
	period: "24h",
	sort: "count",
	order: "desc",
	page: 1,
} as const;

/** Detalle de una transacción (por nombre) con sus ejemplos. */
export const transactionSearchInputSchema = z.object({
	name: z.string().trim().min(1).max(2048).optional().catch(undefined),
	period: periodInput,
	environment: filterInput,
	release: filterInput,
	samples: z.enum(["slowest", "recent"]).optional().catch(undefined),
});

export const TRANSACTION_SEARCH_DEFAULTS = {
	period: "24h",
	samples: "slowest",
} as const;
