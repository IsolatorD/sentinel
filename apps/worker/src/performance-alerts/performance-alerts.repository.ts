import type { RuleRecord } from "../alerts/alerts.repository.js";
import type { Measurement } from "./performance-alerts.domain.js";

export interface MeasureQuery {
	projectId: string;
	since: Date;
	environment: string | null;
	transactionName: string | null;
}

/** Acceso a datos de la evaluación de reglas de rendimiento (en los tests se sustituye por un doble). */
export abstract class PerformanceAlertsRepository {
	abstract rules(): Promise<RuleRecord[]>;
	abstract measure(query: MeasureQuery): Promise<Measurement>;
}
