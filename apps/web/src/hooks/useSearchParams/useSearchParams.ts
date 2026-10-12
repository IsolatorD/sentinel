import { useNavigate, useSearch } from "@tanstack/react-router";
import { useCallback, useMemo } from "react";
import { safeRedirect } from "@/utils/redirect/redirect";
import {
	omitDefaults,
	resolveAlertsSearch,
	resolveIssueSearch,
	resolveIssuesSearch,
	resolveOverviewSearch,
	resolvePerformanceSearch,
	resolveSettingsSearch,
	resolveTransactionSearch,
} from "@/utils/searchParams/searchParams";
import {
	ALERTS_SEARCH_DEFAULTS,
	ISSUES_SEARCH_DEFAULTS,
	OVERVIEW_SEARCH_DEFAULTS,
	PERFORMANCE_SEARCH_DEFAULTS,
	SETTINGS_SEARCH_DEFAULTS,
	TRANSACTION_SEARCH_DEFAULTS,
} from "@/utils/searchParams/searchParams.constants";
import type {
	AlertsSearch,
	IssueSearch,
	IssuesSearch,
	OverviewSearch,
	PerformanceSearch,
	SettingsSearch,
	TransactionSearch,
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

export function usePerformanceSearch() {
	const raw = useSearch({ strict: false });
	const navigate = useNavigate();
	const search = useMemo(() => resolvePerformanceSearch(raw), [raw]);
	const update = useCallback(
		(
			patch: Partial<PerformanceSearch>,
			options: { resetPage?: boolean } = {},
		) =>
			navigate({
				to: ".",
				search: (prev: Record<string, unknown>) =>
					omitDefaults(
						{ ...prev, ...patch, ...(options.resetPage ? { page: 1 } : {}) },
						PERFORMANCE_SEARCH_DEFAULTS,
					),
				replace: true,
			}),
		[navigate],
	);
	return { search, update };
}

export function useOverviewSearch() {
	const raw = useSearch({ strict: false });
	const navigate = useNavigate();
	const search = useMemo(() => resolveOverviewSearch(raw), [raw]);
	const update = useCallback(
		(patch: Partial<OverviewSearch>) =>
			navigate({
				to: ".",
				search: (prev: Record<string, unknown>) =>
					omitDefaults({ ...prev, ...patch }, OVERVIEW_SEARCH_DEFAULTS),
				replace: true,
			}),
		[navigate],
	);
	return { search, update };
}

export function useSettingsSearch() {
	const raw = useSearch({ strict: false });
	const navigate = useNavigate();
	const search = useMemo(() => resolveSettingsSearch(raw), [raw]);
	const update = useCallback(
		(patch: Partial<SettingsSearch>) =>
			navigate({
				to: ".",
				search: (prev: Record<string, unknown>) =>
					omitDefaults({ ...prev, ...patch }, SETTINGS_SEARCH_DEFAULTS),
				// Cada sección es un lugar propio: atrás/adelante del navegador recorren las que se visitaron.
			}),
		[navigate],
	);
	return { search, update };
}

export function useTransactionSearch() {
	const raw = useSearch({ strict: false });
	const navigate = useNavigate();
	const search = useMemo(() => resolveTransactionSearch(raw), [raw]);
	const update = useCallback(
		(patch: Partial<TransactionSearch>) =>
			navigate({
				to: ".",
				search: (prev: Record<string, unknown>) =>
					omitDefaults({ ...prev, ...patch }, TRANSACTION_SEARCH_DEFAULTS),
				replace: true,
			}),
		[navigate],
	);
	return { search, update };
}

/** Destino al que volver tras iniciar sesión (`?redirect=`), si es una ruta interna segura. */
export function useRedirectTarget(): string | undefined {
	const raw = useSearch({ strict: false }) as { redirect?: unknown };
	return safeRedirect(raw.redirect);
}
