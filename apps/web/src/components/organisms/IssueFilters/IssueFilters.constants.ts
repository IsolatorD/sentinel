import { ISSUE_STATUSES } from "@sentinel/shared";

export const TABS = [...ISSUE_STATUSES, "all"] as const;

export const SEARCH_DELAY_MS = 300;

/** Lista de opciones que siempre incluye el valor seleccionado, aunque no esté entre los conocidos. */
export function withCurrent(
	options: string[] | undefined,
	current: string | undefined,
): string[] {
	const list = options ?? [];
	return current && !list.includes(current) ? [current, ...list] : list;
}
