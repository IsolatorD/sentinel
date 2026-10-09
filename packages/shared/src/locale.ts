export const SUPPORTED_LOCALES = ["en", "es"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

export const isLocale = (value: unknown): value is Locale =>
	typeof value === "string" &&
	(SUPPORTED_LOCALES as readonly string[]).includes(value);

/**
 * Elige el idioma de una cabecera `Accept-Language` (`es-AR,es;q=0.9,en;q=0.8`): el primero, por
 * prioridad, que la plataforma soporta. Sin cabecera, o sin ninguno soportado, el idioma por defecto.
 */
export function parseAcceptLanguage(header: string | null | undefined): Locale {
	if (!header) return DEFAULT_LOCALE;
	const candidates = header
		.split(",")
		.map((part, index) => {
			const [tag, ...params] = part.trim().split(";");
			const q = params
				.map((p) => p.trim())
				.find((p) => p.startsWith("q="))
				?.slice(2);
			const quality = q === undefined ? 1 : Number(q);
			return {
				language: tag.trim().toLowerCase().split("-")[0],
				quality: Number.isFinite(quality) ? quality : 0,
				index,
			};
		})
		.filter((c) => c.language && c.quality > 0)
		.sort((a, b) => b.quality - a.quality || a.index - b.index);
	return (
		(candidates.find((c) => isLocale(c.language))?.language as Locale) ??
		DEFAULT_LOCALE
	);
}
