import { safeRedirect } from "@/utils/redirect/redirect";

/**
 * Dónde cae la persona tras abrir el enlace de verificación. Conserva el destino original (p. ej. el
 * enlace de una invitación) para poder continuar donde iba.
 */
export function verificationCallbackUrl(
	origin: string,
	redirect?: string,
): string {
	const target = safeRedirect(redirect);
	const url = new URL("/email-verified", origin);
	if (target) url.searchParams.set("redirect", target);
	return url.toString();
}

/** Parámetros de `/verify-email`: la dirección (acotada) y un destino interno seguro. */
export function parseVerifySearch(search: Record<string, unknown>): {
	email?: string;
	redirect?: string;
} {
	const email =
		typeof search.email === "string" && search.email.length <= 254
			? search.email
			: undefined;
	const redirect = safeRedirect(search.redirect);
	return { ...(email && { email }), ...(redirect && { redirect }) };
}

/**
 * Parámetros de `/email-verified`. El servidor añade `error=invalid_token` o `token_expired` cuando la
 * verificación falla: solo se acepta un código en minúsculas y guiones bajos, nunca texto libre.
 */
export function parseVerifiedSearch(search: Record<string, unknown>): {
	error?: string;
	redirect?: string;
} {
	const error =
		typeof search.error === "string" && /^[a-z_]{1,40}$/.test(search.error)
			? search.error
			: undefined;
	const redirect = safeRedirect(search.redirect);
	return { ...(error && { error }), ...(redirect && { redirect }) };
}
