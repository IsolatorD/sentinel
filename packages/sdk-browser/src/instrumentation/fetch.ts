import { stripQuery } from "../url";
import type { AddBreadcrumb, Uninstall } from "./types";

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
		const promise = original.call(this ?? window, input, init);
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
