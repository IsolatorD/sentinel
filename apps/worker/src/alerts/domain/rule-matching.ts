import { type AlertTrigger, levelRank } from "@sentinel/shared";

export interface RuleCriteria {
	trigger: AlertTrigger;
	threshold: number | null;
	windowMinutes: number | null;
	environment: string | null;
	minLevel: string | null;
}

export interface StoredEvent {
	isNewIssue: boolean;
	regressed: boolean;
	level: string;
	environment?: string;
}

/** Filtros opcionales de la regla: entorno exacto y nivel mínimo. */
export function passesFilters(rule: RuleCriteria, event: StoredEvent): boolean {
	if (rule.environment && rule.environment !== event.environment) return false;
	if (rule.minLevel && levelRank(event.level) < levelRank(rule.minLevel))
		return false;
	return true;
}

/** Reglas que se disparan por lo que le pasó al issue con este evento (no por conteo). */
export function firesOnEvent(rule: RuleCriteria, event: StoredEvent): boolean {
	if (rule.trigger === "new_issue") return event.isNewIssue;
	if (rule.trigger === "regression") return event.regressed;
	return false;
}

/** Regla de frecuencia: ¿ya hubo `threshold` eventos dentro de la ventana? */
export function frequencyReached(rule: RuleCriteria, count: number): boolean {
	return (
		rule.trigger === "frequency" &&
		rule.threshold !== null &&
		count >= rule.threshold
	);
}
