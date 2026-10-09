import type { CSSProperties } from "react";

/**
 * Retraso escalonado para que las filas de una lista entren una tras otra. Pasado el máximo todas
 * entran juntas: una lista de 50 filas no debe tardar segundos en terminar de mostrarse.
 */
export function staggerStyle(
	index: number,
	stepMs = 30,
	maxSteps = 8,
): CSSProperties {
	return { animationDelay: `${Math.min(index, maxSteps) * stepMs}ms` };
}
