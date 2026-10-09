const UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
	["year", 365 * 24 * 3600],
	["month", 30 * 24 * 3600],
	["week", 7 * 24 * 3600],
	["day", 24 * 3600],
	["hour", 3600],
	["minute", 60],
	["second", 1],
];

/** "hace 3 horas" / "3 hours ago", según el idioma. */
export function formatRelative(
	date: Date | string,
	locale: string,
	now: number = Date.now(),
): string {
	const seconds = Math.round((new Date(date).getTime() - now) / 1000);
	const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
	for (const [unit, size] of UNITS) {
		if (Math.abs(seconds) >= size || unit === "second") {
			return formatter.format(Math.round(seconds / size), unit);
		}
	}
	return formatter.format(0, "second");
}

/** Fecha y hora completas en el idioma del usuario. */
export function formatDateTime(date: Date | string, locale: string): string {
	return new Intl.DateTimeFormat(locale, {
		dateStyle: "medium",
		timeStyle: "medium",
	}).format(new Date(date));
}

/** Número compacto: 1.2K, 3.4M. */
export function formatCompact(value: number, locale: string): string {
	return new Intl.NumberFormat(locale, {
		notation: "compact",
		maximumFractionDigits: 1,
	}).format(value);
}
