import {
	PERFORMANCE_MIN_SAMPLES,
	type PerformanceTrigger,
} from "@sentinel/shared";

/** Lo medido en la ventana de una regla. */
export interface Measurement {
	sampleCount: number;
	/** p95 de la duración en ms (`null` si no hubo transacciones). */
	p95: number | null;
	/** Transacciones que terminaron con un estado distinto de `ok`. */
	errors: number;
}

/** La métrica que vigila el tipo de regla: p95 en ms, o la tasa de errores en porcentaje (0-100). */
export function metricValue(
	trigger: PerformanceTrigger,
	m: Measurement,
): number | null {
	if (m.sampleCount === 0) return null;
	return trigger === "p95_above" ? m.p95 : (m.errors / m.sampleCount) * 100;
}

/**
 * ¿Hay que avisar? Solo con muestras suficientes (un p95 de tres transacciones no significa nada) y
 * cuando la métrica supera el umbral estrictamente.
 */
export function isBreached(
	trigger: PerformanceTrigger,
	threshold: number,
	m: Measurement,
): boolean {
	if (m.sampleCount < PERFORMANCE_MIN_SAMPLES) return false;
	const value = metricValue(trigger, m);
	return value !== null && value > threshold;
}
