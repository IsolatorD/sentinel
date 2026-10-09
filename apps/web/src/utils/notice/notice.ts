import { isMessageCode, translate } from "@sentinel/shared";
import { toast } from "sonner";
import i18n from "@/i18n";
import {
	NOTICE_CODE_HEADER,
	NOTICE_HEADER,
} from "@/utils/notice/notice.constants";
import type { HeaderBag } from "@/utils/notice/noticeInterface";

function read(headers: HeaderBag, name: string): string | undefined {
	const raw =
		typeof (headers as { get?: unknown }).get === "function"
			? (headers as { get: (n: string) => unknown }).get(name)
			: (headers as Record<string, unknown>)[name];
	return typeof raw === "string" && raw.length > 0 ? raw : undefined;
}

/** Quita los `{{valores}}` que no llegaron (y las comillas que los rodean) del texto de respaldo. */
export function withoutPlaceholders(text: string): string {
	return text
		.replace(/\s*[«“"]?\{\{\w+\}\}[»”"]?/g, "")
		.replace(/\s{2,}/g, " ")
		.trim();
}

/**
 * Texto de un aviso de éxito: el que manda la API (ya traducido) o, si solo llegó el código, el del
 * catálogo compartido en el idioma de la interfaz.
 */
export function noticeText(headers: HeaderBag): string | undefined {
	const message = read(headers, NOTICE_HEADER);
	if (message) {
		try {
			return decodeURIComponent(message);
		} catch {
			// Cabecera mal codificada: se cae al texto de respaldo.
		}
	}
	const code = read(headers, NOTICE_CODE_HEADER);
	if (!code || !isMessageCode(code)) return undefined;
	const locale = i18n.language?.startsWith("es") ? "es" : "en";
	return withoutPlaceholders(translate(locale, code));
}

/** Muestra el aviso de éxito de una respuesta, si trae uno. Los errores nunca lo muestran. */
export function showNotice(status: number, headers: HeaderBag): void {
	if (status >= 400) return;
	const text = noticeText(headers);
	if (text) toast.success(text);
}

/** Aviso de éxito de una operación que no pasa por nuestra API (p. ej. las de Better Auth). */
export function notify(text: string): void {
	toast.success(text);
}
