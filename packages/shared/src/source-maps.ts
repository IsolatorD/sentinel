/** Tamaño máximo de un source map subido (sin comprimir). */
export const MAX_SOURCE_MAP_BYTES = 25 * 1024 * 1024;

/**
 * Nombre canónico de un archivo minificado: la ruta con "~" en lugar del origen, sin query ni hash.
 *   https://app.example.com/assets/app.3f2a.js?v=2  ->  ~/assets/app.3f2a.js
 *   /assets/app.js.map                               ->  ~/assets/app.js
 * Así el mismo mapa sirve en producción, staging o un CDN. Devuelve null si no es un nombre válido.
 * El API lo usa al subir un mapa y el worker al buscarlo para un frame: deben coincidir siempre.
 */
export function normalizeArtifactName(input: string): string | null {
	let path = input.trim();
	if (!path) return null;

	if (/^[a-z][a-z0-9+.-]*:\/\//i.test(path)) {
		try {
			path = new URL(path).pathname;
		} catch {
			return null;
		}
	}
	path = path.split(/[?#]/, 1)[0];
	if (path.startsWith("~/")) path = path.slice(1);
	if (!path.startsWith("/")) return null;
	if (path.endsWith(".map")) path = path.slice(0, -4);

	// Sin saltos de directorio ni caracteres raros: el nombre se usa como clave, no como ruta de archivo.
	if (path.split("/").some((segment) => segment === ".." || segment === "."))
		return null;
	if (path.length > 500 || /[\u0000-\u001f\\]/.test(path)) return null;
	return `~${path}`;
}

/** Comprobación mínima de que el contenido es un source map v3 (no se valida cada mapping). */
export function looksLikeSourceMap(json: unknown): boolean {
	if (typeof json !== "object" || json === null) return false;
	const map = json as {
		version?: unknown;
		mappings?: unknown;
		sources?: unknown;
	};
	return (
		map.version === 3 &&
		typeof map.mappings === "string" &&
		Array.isArray(map.sources)
	);
}
