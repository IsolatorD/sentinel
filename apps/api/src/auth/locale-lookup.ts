import { type Database, eq, user, userPreference } from "@sentinel/db";
import {
	DEFAULT_LOCALE,
	isLocale,
	type Locale,
	parseAcceptLanguage,
} from "@sentinel/shared";

/** Idioma guardado de una persona, buscada por su id o por su correo. */
async function storedLocale(
	db: Database,
	by: { userId: string } | { email: string },
): Promise<Locale | undefined> {
	const [row] = await db
		.select({ locale: userPreference.locale })
		.from(userPreference)
		.innerJoin(user, eq(user.id, userPreference.userId))
		.where("userId" in by ? eq(user.id, by.userId) : eq(user.email, by.email))
		.limit(1);
	return isLocale(row?.locale) ? row.locale : undefined;
}

/**
 * Idioma para escribirle a alguien que quizá aún no tiene cuenta: el suyo si ya eligió uno; si no, el
 * de quien lo invita; si no, el del navegador de quien lo invita; y por último el idioma por defecto.
 */
export async function localeForInvitee(
	db: Database,
	input: { email: string; inviterId: string; acceptLanguage?: string | null },
): Promise<Locale> {
	return (
		(await storedLocale(db, { email: input.email })) ??
		(await storedLocale(db, { userId: input.inviterId })) ??
		(input.acceptLanguage
			? parseAcceptLanguage(input.acceptLanguage)
			: DEFAULT_LOCALE)
	);
}
