export interface ParsedDsn {
	publicKey: string;
	projectId: string;
	/** URL a la que se envían los eventos. */
	endpoint: string;
	/** URL a la que se envían las transacciones (rendimiento). */
	transactionsEndpoint: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KEY = /^[0-9a-f]{32}$/i;

/**
 * DSN: `<protocolo>://<clavePública>@<host>[/<prefijo>]/<projectId>`.
 * Devuelve null si no es válida (el SDK se desactiva en lugar de lanzar).
 */
export function parseDsn(dsn: string): ParsedDsn | null {
	let url: URL;
	try {
		url = new URL(dsn);
	} catch {
		return null;
	}
	if (url.protocol !== "http:" && url.protocol !== "https:") return null;

	const publicKey = decodeURIComponent(url.username);
	const segments = url.pathname.split("/").filter(Boolean);
	const projectId = segments.pop();
	if (!KEY.test(publicKey) || !projectId || !UUID.test(projectId)) return null;

	const basePath = segments.length > 0 ? `/${segments.join("/")}` : "";
	return {
		publicKey: publicKey.toLowerCase(),
		projectId,
		endpoint: `${url.protocol}//${url.host}${basePath}/api/${projectId}/events`,
		transactionsEndpoint: `${url.protocol}//${url.host}${basePath}/api/${projectId}/transactions`,
	};
}
