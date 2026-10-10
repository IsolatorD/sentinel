/** El mes en curso en UTC: `2026-10`. Los contadores y los límites se reinician cada mes. */
export function monthKey(now: Date): string {
	return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function monthStart(now: Date): Date {
	return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export function nextMonthStart(now: Date): Date {
	return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
}

/** Tope del `Retry-After`: el SDK reintenta al cabo de, como máximo, una hora (por si el límite sube). */
const MAX_RETRY_AFTER_SECONDS = 3_600;

export function retryAfterSeconds(now: Date): number {
	const untilReset = Math.ceil(
		(nextMonthStart(now).getTime() - now.getTime()) / 1000,
	);
	return Math.max(1, Math.min(untilReset, MAX_RETRY_AFTER_SECONDS));
}

/** ¿Ya se llegó al límite? Sin límite (`null`), nunca. */
export function isOverQuota(used: number, quota: number | null): boolean {
	return quota !== null && used >= quota;
}
