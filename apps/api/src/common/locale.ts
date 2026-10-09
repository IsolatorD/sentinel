import { type Locale, parseAcceptLanguage } from "@sentinel/shared";

/** Idioma de una petición: el que declara su cabecera `Accept-Language` (el panel manda el de la interfaz). */
export function requestLocale(headers: {
	"accept-language"?: string | string[];
}): Locale {
	const raw = headers["accept-language"];
	return parseAcceptLanguage(Array.isArray(raw) ? raw.join(",") : raw);
}
