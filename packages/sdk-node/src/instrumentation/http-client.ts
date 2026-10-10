import type { ClientRequest, IncomingMessage, RequestOptions } from "node:http";
import http from "node:http";
import https from "node:https";
import { syncBuiltinESMExports } from "node:module";
import {
	type AddBreadcrumb,
	type StartHttpSpan,
	stripQuery,
	type Uninstall,
} from "@sentinel/core";

type RequestFn = (...args: unknown[]) => ClientRequest;

interface RequestInfo {
	method: string;
	url: string;
}

/** Saca método y URL de cualquiera de las firmas de `http.request` (url, opciones, callback...). */
function describe(
	args: unknown[],
	defaultProtocol: string,
): RequestInfo | undefined {
	const [first, second] = args;
	let options: RequestOptions & { href?: string } = {};
	let base: URL | undefined;
	if (typeof first === "string") base = new URL(first);
	else if (first instanceof URL) base = first;
	else if (first && typeof first === "object")
		options = first as RequestOptions;
	if (second && typeof second === "object" && typeof second !== "function")
		options = { ...options, ...(second as RequestOptions) };

	const protocol = options.protocol ?? base?.protocol ?? defaultProtocol;
	const host =
		options.hostname ?? options.host ?? base?.hostname ?? "localhost";
	const port = options.port ?? base?.port;
	const path = options.path ?? (base ? `${base.pathname}${base.search}` : "/");
	const url = `${protocol}//${host}${port ? `:${port}` : ""}${path}`;
	return { method: String(options.method ?? "GET").toUpperCase(), url };
}

/**
 * Mide las peticiones salientes hechas con los módulos `http` y `https` (lo que usan axios, got,
 * node-fetch...): un span `http.client` por cada una y, si hay que continuar la traza,
 * la cabecera `traceparent`.
 */
export function installHttpClient(
	add: AddBreadcrumb,
	isOwnUrl: (url: string) => boolean,
	startSpan?: StartHttpSpan,
): Uninstall {
	const restores: Uninstall[] = [];

	for (const [mod, protocol] of [
		[http, "http:"],
		[https, "https:"],
	] as const) {
		for (const name of ["request", "get"] as const) {
			const original = mod[name] as unknown as RequestFn;
			const wrapped = function (this: unknown, ...args: unknown[]) {
				const req = original.apply(this, args);
				try {
					const info = describe(args, protocol);
					if (!info || isOwnUrl(info.url)) return req;
					const started = Date.now();
					const handle = startSpan?.(info);
					for (const [header, value] of Object.entries(handle?.headers ?? {}))
						if (!req.headersSent) req.setHeader(header, value);

					let done = false;
					const finish = (status?: number, error?: string) => {
						if (done) return;
						done = true;
						handle?.end(status);
						try {
							add({
								category: "http",
								type: "http",
								level: error || (status ?? 0) >= 400 ? "warning" : "info",
								data: {
									method: info.method,
									url: stripQuery(info.url),
									...(status !== undefined && { status_code: status }),
									...(error && { error }),
									duration_ms: Date.now() - started,
								},
							});
						} catch {}
					};
					req.once("response", (res: IncomingMessage) =>
						finish(res.statusCode),
					);
					req.once("error", (error: Error) => finish(undefined, error.message));
					// Sin respuesta ni error (petición abortada): se cierra igualmente.
					req.once("close", () => finish());
				} catch {
					// Medir nunca debe romper la petición.
				}
				return req;
			};
			(mod as unknown as Record<string, unknown>)[name] = wrapped;
			restores.push(() => {
				if ((mod as unknown as Record<string, unknown>)[name] === wrapped)
					(mod as unknown as Record<string, unknown>)[name] = original;
			});
		}
	}
	// Sin esto, quien importó `{ request }` de `node:http` (ESM) seguiría viendo la función original.
	syncBuiltinESMExports();
	return () => {
		for (const restore of restores) restore();
		syncBuiltinESMExports();
	};
}
