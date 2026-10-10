/** Variación en % (con un decimal) respecto al periodo anterior; `null` si antes no hubo nada con lo que comparar. */
export function changePercent(
	current: number,
	previous: number,
): number | null {
	if (previous === 0) return null;
	return Math.round(((current - previous) / previous) * 1000) / 10;
}
