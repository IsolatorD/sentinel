const MAX_QUOTA = 1_000_000_000;

/**
 * Lo que se escribió en un campo de límite: vacío = sin límite (`null`); un entero entre 1 y mil millones
 * es el límite; cualquier otra cosa es inválida.
 */
export function parseQuota(raw: string): number | null | "invalid" {
	const text = raw.trim().replace(/[.,\s]/g, "");
	if (text === "") return null;
	if (!/^\d+$/.test(text)) return "invalid";
	const value = Number(text);
	return value >= 1 && value <= MAX_QUOTA ? value : "invalid";
}
