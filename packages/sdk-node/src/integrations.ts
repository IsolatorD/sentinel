import { getClient } from "./hub";
import { normalizePath } from "./route";

// Tipos mínimos y estructurales: no hace falta tener Express ni Fastify instalados para compilar.
interface ExpressRequest {
	method: string;
	baseUrl?: string;
	path?: string;
	route?: { path?: unknown };
}
interface ExpressResponse {
	once(event: "finish" | "close", listener: () => void): unknown;
}
type ExpressNext = (error?: unknown) => void;

/**
 * Express: pone a cada transacción el nombre de la ruta (`GET /users/:id`) en lugar del de la URL,
 * que Express solo conoce una vez resuelta la ruta.
 *
 *     app.use(Sentinel.expressRequestHandler());
 *     // ...tus rutas...
 *     app.use(Sentinel.expressErrorHandler());
 */
export function expressRequestHandler() {
	return (req: ExpressRequest, res: ExpressResponse, next: ExpressNext) => {
		const tx = getClient()?.activeTransaction();
		if (tx) {
			res.once("close", () => {
				try {
					const route = req.route?.path;
					if (typeof route === "string")
						tx.setName(
							`${req.method.toUpperCase()} ${req.baseUrl ?? ""}${route}`,
						);
				} catch {}
			});
		}
		next();
	};
}

/** Express: captura los errores que llegan al manejador de errores y los pasa al siguiente. */
export function expressErrorHandler(
	shouldCapture: (error: unknown) => boolean = defaultShouldCapture,
) {
	return (
		error: unknown,
		_req: ExpressRequest,
		_res: unknown,
		next: ExpressNext,
	) => {
		if (shouldCapture(error))
			getClient()?.captureException(error, {
				tags: { handled: "true", mechanism: "express" },
			});
		next(error);
	};
}

/** Un 4xx lanzado como error (`error.status`/`statusCode` < 500) es del cliente, no un fallo de la app. */
function defaultShouldCapture(error: unknown): boolean {
	const status =
		(error as { status?: number; statusCode?: number } | undefined)?.status ??
		(error as { statusCode?: number } | undefined)?.statusCode;
	return typeof status !== "number" || status >= 500;
}

interface FastifyLike {
	addHook(
		name: "onRequest" | "onError",
		handler: (
			request: { method: string; routeOptions?: { url?: string } },
			reply: unknown,
			errorOrDone?: unknown,
		) => unknown,
	): unknown;
}

/**
 * Fastify (y Nest con el adaptador de Fastify): nombra cada transacción con la ruta registrada
 * (`GET /users/:id`) y captura los errores.
 *
 *     Sentinel.setupFastify(app);
 */
export function setupFastify(fastify: FastifyLike): void {
	// Async a propósito: Fastify espera un `done` a los hooks síncronos de 3 o más parámetros.
	fastify.addHook("onRequest", async (request) => {
		try {
			const route = request.routeOptions?.url;
			if (route)
				getClient()
					?.activeTransaction()
					?.setName(`${request.method.toUpperCase()} ${route}`);
		} catch {}
	});
	fastify.addHook("onError", async (_request, _reply, error) => {
		if (defaultShouldCapture(error))
			getClient()?.captureException(error, {
				tags: { handled: "true", mechanism: "fastify" },
			});
	});
}

export { normalizePath };
