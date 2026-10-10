import type { TraceTransaction } from "@sentinel/shared";

export interface TraceRow {
	transaction: TraceTransaction;
	depth: number;
	/** Inicio respecto al de la traza, en ms. */
	offsetMs: number;
	/** Errores capturados durante esta transacción. */
	eventIds: string[];
}

export interface TraceLayout {
	rows: TraceRow[];
	/** Duración de toda la traza, de la primera transacción a la última en terminar. */
	totalMs: number;
	/** Errores que no se pudieron asignar a ninguna transacción de la traza. */
	loose: string[];
}
