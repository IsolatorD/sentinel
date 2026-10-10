import type { Uninstall } from "./client";
import type { AddBreadcrumb } from "./console";
import type { StartHttpSpan } from "./fetch";
import { stripQuery } from "./url";

interface TrackedXhr extends XMLHttpRequest {
	__sentinel?: { method: string; url: string; started?: number };
}

export function installXhr(
	add: AddBreadcrumb,
	isOwnUrl: (url: string) => boolean,
	startSpan?: StartHttpSpan,
): Uninstall {
	if (typeof XMLHttpRequest === "undefined") return () => {};
	const proto = XMLHttpRequest.prototype;
	const originalOpen = proto.open;
	const originalSend = proto.send;

	proto.open = function (
		this: TrackedXhr,
		method: string,
		url: string | URL,
		...rest: unknown[]
	) {
		try {
			this.__sentinel = {
				method: String(method).toUpperCase(),
				url: String(url),
			};
		} catch {}
		return (originalOpen as (...args: unknown[]) => void).call(
			this,
			method,
			url,
			...rest,
		);
	} as typeof proto.open;

	proto.send = function (
		this: TrackedXhr,
		body?: Document | XMLHttpRequestBodyInit | null,
	) {
		const info = this.__sentinel;
		if (info && !isOwnUrl(info.url)) {
			info.started = Date.now();
			let handle: ReturnType<StartHttpSpan> | undefined;
			try {
				handle = startSpan?.({ method: info.method, url: info.url });
				for (const [name, value] of Object.entries(handle?.headers ?? {}))
					this.setRequestHeader(name, value);
			} catch {}
			this.addEventListener("loadend", () => {
				handle?.end(this.status || undefined);
				try {
					add({
						category: "xhr",
						type: "http",
						level: this.status >= 400 || this.status === 0 ? "warning" : "info",
						data: {
							method: info.method,
							url: stripQuery(info.url),
							status_code: this.status,
							duration_ms: Date.now() - (info.started ?? Date.now()),
						},
					});
				} catch {}
			});
		}
		return originalSend.call(this, body);
	};

	return () => {
		proto.open = originalOpen;
		proto.send = originalSend;
	};
}
