import { ISSUE_SORTS, ISSUE_STATUSES, levelSchema } from "@sentinel/shared";
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
	sort: z.enum(ISSUE_SORTS).optional().catch(undefined),
	order: z.enum(["asc", "desc"]).optional().catch(undefined),
	page: z.coerce.number().int().min(1).optional().catch(undefined),
});
export type IssuesSearchInput = z.infer<typeof issuesSearchInputSchema>;

export interface IssuesSearch {
	status: (typeof ISSUE_STATUSES)[number] | "all";
	q?: string;
	level?: z.infer<typeof levelSchema>;
	environment?: string;
	release?: string;
	sort: (typeof ISSUE_SORTS)[number];
	order: "asc" | "desc";
	page: number;
}

export const ISSUES_SEARCH_DEFAULTS = {
	status: "unresolved",
	sort: "lastSeen",
	order: "desc",
	page: 1,
} as const;

/** Lee los parámetros de la URL (cualquier cosa) y devuelve valores válidos con sus defaults. */
export function resolveIssuesSearch(raw: unknown): IssuesSearch {
	const input = issuesSearchInputSchema.parse(raw ?? {});
	return {
		status: input.status ?? ISSUES_SEARCH_DEFAULTS.status,
		q: input.q,
		level: input.level,
		environment: input.environment,
		release: input.release,
		sort: input.sort ?? ISSUES_SEARCH_DEFAULTS.sort,
		order: input.order ?? ISSUES_SEARCH_DEFAULTS.order,
		page: input.page ?? ISSUES_SEARCH_DEFAULTS.page,
	};
}

export const issueSearchInputSchema = z.object({
	/** Evento seleccionado; sin él se muestra el último. */
	event: z.string().uuid().optional().catch(undefined),
	tab: z.enum(["details", "events"]).optional().catch(undefined),
});
export type IssueSearchInput = z.infer<typeof issueSearchInputSchema>;

export interface IssueSearch {
	event?: string;
	tab: "details" | "events";
}

export function resolveIssueSearch(raw: unknown): IssueSearch {
	const input = issueSearchInputSchema.parse(raw ?? {});
	return { event: input.event, tab: input.tab ?? "details" };
}

/** Quita de la URL lo que vale lo mismo que el valor por defecto, para mantenerla corta. */
export function omitDefaults<T extends Record<string, unknown>>(
	search: T,
	defaults: Record<string, unknown>,
): Partial<T> {
	return Object.fromEntries(
		Object.entries(search).filter(
			([key, value]) => value !== undefined && value !== defaults[key],
		),
	) as Partial<T>;
}
