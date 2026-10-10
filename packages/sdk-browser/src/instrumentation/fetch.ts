import { stripQuery } from "../url";
import type { AddBreadcrumb, StartHttpSpan, Uninstall } from "./types";

function requestInfo(input: RequestInfo | URL, init?: RequestInit) {
	let url = "";
	let method = init?.method;
	if (typeof input === "string") url = input;
	else if (typeof URL !== "undefined" && input instanceof URL) url = input.href;
	else if (typeof Request !== "undefined" && input instanceof Request) {
		url = input.url;
		method = method ?? input.method;
	}
	return { url, method: (method ?? "GET").toUpperCase() };
}

/** `isOwnUrl` evita registrar (y entrar en bucle con) las peticiones del propio SDK. */
export function installFetch(
	add: AddBreadcrumb,
	isOwnUrl: (url: string) => boolean,
	startSpan?: StartHttpSpan,
): Uninstall {
	if (typeof window === "undefined" || typeof window.fetch !== "function")
		return () => {};
	const original = window.fetch;

	const wrapped: typeof fetch = function (this: unknown, input, init) {
		let info: ReturnType<typeof requestInfo> | undefined;
		try {
			info = requestInfo(input, init);
			if (isOwnUrl(info.url)) info = undefined;
		} catch {
			info = undefined;
		}
		const started = Date.now();
		let handle: ReturnType<StartHttpSpan> | undefined;
		try {
			handle = info && startSpan?.(info);
		} catch {}
		let args: [RequestInfo | URL, RequestInit | undefined] = [input, init];
		if (handle?.headers) {
			try {
				// Los headers de `init` reemplazan a los del Request, así que se combinan a mano.
				const headers = new Headers(
					init?.headers ??
						(typeof Request !== "undefined" && input instanceof Request
							? input.headers
							: undefined),
				);
				for (const [name, value] of Object.entries(handle.headers))
					if (!headers.has(name)) headers.set(name, value);
				args = [input, { ...init, headers }];
			} catch {}
		}
		const promise = original.call(this ?? window, ...args);
		if (!info) return promise;

		const { url, method } = info;
		const data = (extra: Record<string, unknown>) => ({
			method,
			url: stripQuery(url),
			duration_ms: Date.now() - started,
			...extra,
		});
		promise.then(
			(res) => {
				handle?.end(res.status);
				try {
					add({
						category: "fetch",
						type: "http",
						level: res.ok ? "info" : "warning",
						data: data({ status_code: res.status }),
					});
				} catch {}
			},
			(error) => {
				handle?.end(undefined);
				try {
					add({
						category: "fetch",
						type: "http",
						level: "error",
						data: data({ error: String(error?.message ?? error) }),
					});
				} catch {}
			},
		);
		return promise;
	};

	window.fetch = wrapped;
	return () => {
		// Solo restauramos si nadie más volvió a envolver fetch encima.
		if (window.fetch === wrapped) window.fetch = original;
	};
}
