/** Altura de cada barra (0–1) respecto al valor más alto; con todo en cero, todas valen 0. */
export function barHeights(values: number[]): number[] {
	const max = Math.max(0, ...values);
	return values.map((v) => (max === 0 ? 0 : v / max));
}

/** Etiqueta del intervalo: con hora si dura menos de un día; solo la fecha si dura un día. */
export function formatBucket(
	start: string,
	bucketMinutes: number,
	locale: string,
): string {
	const options: Intl.DateTimeFormatOptions =
		bucketMinutes >= 1440
			? { dateStyle: "medium", timeZone: "UTC" }
			: { dateStyle: "medium", timeStyle: "short" };
	return new Intl.DateTimeFormat(locale, options).format(new Date(start));
}
