/**
 * Oculta la parte secreta de la URL de un webhook (en Slack el token va en la ruta): se muestra el
 * origen y los últimos caracteres, suficientes para reconocerla y no para usarla.
 */
export function maskUrl(raw: string): string {
	try {
		const url = new URL(raw);
		const path = `${url.pathname}${url.search}`;
		const tail = path.length > 8 ? path.slice(-4) : "";
		return `${url.origin}/…${tail}`;
	} catch {
		return "…";
	}
}
