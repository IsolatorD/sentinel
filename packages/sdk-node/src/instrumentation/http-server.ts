import http from "node:http";
import https from "node:https";
import {
	parseTraceparent,
	type StartTransactionContext,
	stripQuery,
	type Tracer,
	type Uninstall,
} from "@sentinel/core";
import { requestScope } from "../request-scope";
import { normalizePath } from "../route";

export interface ServerOptions {
	tracer: Tracer;
	/** Nombre de la transacción; por defecto `<MÉTODO> <ruta sin ids>`. */
	transactionName?: (info: {
		method: string;
		path: string;
	}) => string | undefined;
}

type Emit = (
	this: unknown,
	event: string | symbol,
	...args: unknown[]
) => boolean;

/**
 * Mide cada petición que atiende un servidor `http` o `https` (y con él Express, Fastify, Nest...).
 * Si llega `traceparent`, continúa esa traza en lugar de abrir una nueva.
 */
export function installHttpServer({
	tracer,
	transactionName,
}: ServerOptions): Uninstall {
	function prepare(req: http.IncomingMessage) {
		const method = (req.method ?? "GET").toUpperCase();
		const path = stripQuery(req.url ?? "/");
		const header = req.headers.traceparent;
		const incoming = parseTraceparent(
			Array.isArray(header) ? header[0] : header,
		);
		const userAgent = req.headers["user-agent"];
		const context: StartTransactionContext = {
			name:
				transactionName?.({ method, path }) ??
				`${method} ${normalizePath(path)}`,
			op: "http.server",
			traceId: incoming?.traceId,
			parentSpanId: incoming?.parentSpanId,
			// Si quien nos llama ya decidió registrar (o no) la traza, se respeta.
			sampled: incoming?.sampled,
		};
		return {
			method,
			context,
			request: {
				url: path,
				method,
				...(userAgent && { headers: { "User-Agent": String(userAgent) } }),
			},
		};
	}

	const patch = (proto: { emit: Emit }): Uninstall => {
		const original = proto.emit;
		const wrapped: Emit = function (this: unknown, event, ...args) {
			if (event !== "request") return original.call(this, event, ...args);
			const [req, res] = args as [http.IncomingMessage, http.ServerResponse];

			let prepared: ReturnType<typeof prepare> | undefined;
			try {
				prepared = prepare(req);
			} catch {
				// Un fallo del SDK nunca debe impedir que la app atienda la petición.
			}
			if (!prepared) return original.call(this, event, ...args);

			const { method, context, request } = prepared;
			return requestScope.run({ request }, () =>
				tracer.runTransaction(context, (tx) => {
					tx.setTag("http.method", method);
					res.once("close", () => {
						try {
							const code = res.statusCode;
							tx.setTag("http.status_code", String(code));
							// En un servidor, un 4xx es un error del cliente, no un fallo de la transacción.
							tx.setStatus(
								!res.writableFinished
									? "cancelled"
									: code >= 500
										? "internal_error"
										: "ok",
							);
							tx.finish();
						} catch {}
					});
					return original.call(this, event, ...args);
				}),
			);
		};
		proto.emit = wrapped;
		// Solo se restaura si nadie más volvió a envolver `emit` encima.
		return () => {
			if (proto.emit === wrapped) proto.emit = original;
		};
	};

	const restores = [
		patch(http.Server.prototype as unknown as { emit: Emit }),
		patch(https.Server.prototype as unknown as { emit: Emit }),
	];
	return () => {
		for (const restore of restores) restore();
	};
}
