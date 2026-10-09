import { useNavigate, useSearch } from "@tanstack/react-router";
import { useCallback, useMemo } from "react";
import {
	omitDefaults,
	resolveAlertsSearch,
	resolveIssueSearch,
	resolveIssuesSearch,
} from "@/utils/searchParams/searchParams";
import {
	ALERTS_SEARCH_DEFAULTS,
	ISSUES_SEARCH_DEFAULTS,
} from "@/utils/searchParams/searchParams.constants";
import type {
	AlertsSearch,
	IssueSearch,
	IssuesSearch,
} from "@/utils/searchParams/searchParamsInterface";

// La URL es la fuente de verdad del estado de la pantalla (filtros, página, evento elegido):
// se puede compartir, recargar y usar con los botones atrás/adelante.

export function useIssuesSearch() {
	const raw = useSearch({ strict: false });
	const navigate = useNavigate();
	const search = useMemo(() => resolveIssuesSearch(raw), [raw]);
	const update = useCallback(
		(patch: Partial<IssuesSearch>, options: { resetPage?: boolean } = {}) =>
			navigate({
				to: ".",
				search: (prev: Record<string, unknown>) =>
					// Al cambiar un filtro se vuelve a la primera página.
					omitDefaults(
						{ ...prev, ...patch, ...(options.resetPage ? { page: 1 } : {}) },
						ISSUES_SEARCH_DEFAULTS,
					),
				replace: true,
			}),
		[navigate],
	);
	return { search, update };
}

export function useIssueSearch() {
	const raw = useSearch({ strict: false });
	const navigate = useNavigate();
	const search = useMemo(() => resolveIssueSearch(raw), [raw]);
	const update = useCallback(
		(patch: Partial<IssueSearch>) =>
			navigate({
				to: ".",
				search: (prev: Record<string, unknown>) =>
					omitDefaults({ ...prev, ...patch }, { tab: "details" }),
				replace: true,
			}),
		[navigate],
	);
	return { search, update };
}

export function useAlertsSearch() {
	const raw = useSearch({ strict: false });
	const navigate = useNavigate();
	const search = useMemo(() => resolveAlertsSearch(raw), [raw]);
	const update = useCallback(
		(patch: Partial<AlertsSearch>) =>
			navigate({
				to: ".",
				search: (prev: Record<string, unknown>) =>
					omitDefaults({ ...prev, ...patch }, ALERTS_SEARCH_DEFAULTS),
				replace: true,
			}),
		[navigate],
	);
	return { search, update };
}
