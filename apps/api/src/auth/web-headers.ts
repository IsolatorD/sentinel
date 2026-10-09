import type { IncomingHttpHeaders } from "node:http";

// Convierte los headers de Node/Fastify al objeto Headers estándar de la Web.
export function toWebHeaders(source: IncomingHttpHeaders): Headers {
	const headers = new Headers();
	for (const [key, value] of Object.entries(source)) {
		if (Array.isArray(value)) {
			for (const v of value) headers.append(key, v);
		} else if (value !== undefined) {
			headers.set(key, value);
		}
	}
	return headers;
}
