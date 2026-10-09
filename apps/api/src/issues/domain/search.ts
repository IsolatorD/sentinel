/** Escapa los comodines de LIKE para que la búsqueda del usuario sea literal. */
export function escapeLike(input: string): string {
	return input.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** Patrón `%texto%` listo para ILIKE. */
export function containsPattern(input: string): string {
	return `%${escapeLike(input)}%`;
}
