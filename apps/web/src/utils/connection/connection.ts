import { ApiError } from "@/utils/apiError/apiError";

/**
 * ¿El fallo es que no se llegó al servidor (apagado, arrancando, sin red) y no una respuesta suya?
 * Un 502/503/504 lo devuelve el proxy o el balanceador cuando la API no contesta; un error de red
 * llega sin respuesta (axios) o con estado 0.
 */
export function isConnectionError(error: unknown): boolean {
	if (error instanceof ApiError)
		return [0, 502, 503, 504].includes(error.status);
	return (
		error instanceof Error &&
		/network error|failed to fetch|econnrefused/i.test(error.message)
	);
}
