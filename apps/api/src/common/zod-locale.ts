import { isMessageCode, type Locale, translate } from "@sentinel/shared";
import { type ZodType, z } from "zod";

const LOCALE_ERRORS = {
	en: z.locales.en().localeError,
	es: z.locales.es().localeError,
} satisfies Record<Locale, unknown>;

export interface LocalizedIssue {
	path: string;
	message: string;
}

/**
 * Vuelve a validar el valor con los mensajes de Zod en el idioma pedido. Se hace con el valor
 * original (no con los issues ya generados) porque Zod necesita saber qué recibió para redactar
 * "se esperaba texto, recibido número". Los mensajes propios de nuestros esquemas son códigos del
 * catálogo y se traducen con él.
 */
export function localizeIssues(
	schema: ZodType,
	value: unknown,
	locale: Locale,
): LocalizedIssue[] {
	const result = schema.safeParse(value, { error: LOCALE_ERRORS[locale] });
	if (result.success) return [];
	return result.error.issues.map((issue) => ({
		path: issue.path.join("."),
		message: isMessageCode(issue.message)
			? translate(locale, issue.message)
			: issue.message,
	}));
}
