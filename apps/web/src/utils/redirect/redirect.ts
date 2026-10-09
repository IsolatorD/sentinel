/**
 * Valida el destino al que volver tras iniciar sesión. Solo se aceptan rutas internas: un
 * `?redirect=https://sitio-malicioso` tras el login sería una redirección abierta (phishing).
 */
export function safeRedirect(value: unknown): string | undefined {
	if (typeof value !== "string" || value.length === 0 || value.length > 500)
		return undefined;
	if (!value.startsWith("/")) return undefined;
	// "//host" y "/\host" las interpretan los navegadores como otro origen.
	if (value.startsWith("//") || value.startsWith("/\\")) return undefined;
	for (let i = 0; i < value.length; i++) {
		if (value.charCodeAt(i) <= 0x1f) return undefined; // saltos de línea y otros de control
	}
	return value;
}
