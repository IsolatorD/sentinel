import type { IssueStatus } from "@sentinel/shared";

export interface ResolutionState {
	status: IssueStatus;
	/** Release a partir de la cual se considera resuelto; null = cualquier evento reabre. */
	resolvedRelease: string | null;
	/** Si es true, un evento de esa misma release también reabre (la corrección iba en ella). */
	resolvedInclusive: boolean;
}

export interface StatusDecision {
	status: IssueStatus;
	/** Un issue resuelto volvió a ocurrir: es una regresión. */
	regressed: boolean;
}

/**
 * Decide el estado de un issue cuando llega un evento nuevo.
 *
 * - `unresolved` e `ignored` no cambian (un issue ignorado sigue ignorado aunque ocurra).
 * - `resolved` sin release: cualquier evento nuevo lo reabre.
 * - `resolved` con release: solo lo reabre un evento de una release posterior (o igual, si es
 *   inclusiva). Los eventos de versiones viejas que siguen en circulación no lo reabren.
 * - Si no se puede determinar si el evento es más nuevo (sin release, o versiones que no se
 *   pueden comparar), se reabre: es preferible un falso aviso a esconder una regresión.
 */
export function nextStatusOnEvent(
	state: ResolutionState,
	eventRelease: string | undefined,
	compare: (a: string, b: string) => number | undefined,
): StatusDecision {
	if (state.status !== "resolved")
		return { status: state.status, regressed: false };

	if (state.resolvedRelease === null || !eventRelease) {
		return { status: "unresolved", regressed: true };
	}

	const order = compare(eventRelease, state.resolvedRelease);
	if (order === undefined) return { status: "unresolved", regressed: true };

	const reopens = state.resolvedInclusive ? order >= 0 : order > 0;
	return reopens
		? { status: "unresolved", regressed: true }
		: { status: "resolved", regressed: false };
}
