import { DEFAULT_LOCALE, type Locale } from "../locale.js";
import { en, type MessageCode } from "./en.js";
import { es } from "./es.js";

export type { MessageCode } from "./en.js";

export const MESSAGES: Record<Locale, Record<MessageCode, string>> = { en, es };

export type MessageParams = Record<string, string | number>;

export const isMessageCode = (value: unknown): value is MessageCode =>
	typeof value === "string" && Object.hasOwn(en, value);

/** Texto de un mensaje en un idioma, con sus `{{valores}}` sustituidos. */
export function translate(
	locale: Locale,
	code: MessageCode,
	params: MessageParams = {},
): string {
	const template = (MESSAGES[locale] ?? MESSAGES[DEFAULT_LOCALE])[code];
	return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) =>
		Object.hasOwn(params, key) ? String(params[key]) : match,
	);
}
