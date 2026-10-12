import { isMessageCode, translate } from "@sentinel/shared";
import i18n from "@/i18n";
import { ApiError } from "@/utils/apiError/apiError";

/**
 * Texto para mostrar ante un error. La API ya responde en el idioma de la interfaz, así que su
 * mensaje se usa tal cual; si el texto no llegó pero sí el código, se traduce con el catálogo
 * compartido; y si no hay nada reconocible, un mensaje genérico.
 */
export function apiErrorText(error: unknown, generic: string): string {
	if (!(error instanceof ApiError)) return generic;
	// Un 5xx es un fallo nuestro y no se detalla, salvo el 502 con motivo conocido: "un servicio
	// externo (p. ej. Jira) no respondió", que sí le sirve al usuario.
	if (error.status >= 500 && !(error.status === 502 && error.reason))
		return generic;
	if (error.reason && isMessageCode(error.reason)) {
		return (
			error.message ||
			translate(i18n.language?.startsWith("es") ? "es" : "en", error.reason)
		);
	}
	return generic;
}
