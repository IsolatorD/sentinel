import {
	type ClientDeps,
	CoreClient,
	installConsole,
	installFetch,
	installXhr,
	originalConsole,
	type Platform,
} from "@sentinel/core";
import { installClicks } from "./instrumentation/clicks";
import { installGlobalHandlers } from "./instrumentation/global-handlers";
import { installNavigation } from "./instrumentation/navigation";
import { BrowserTracer } from "./tracing/browser-tracer";
import type {
	Breadcrumb,
	BreadcrumbOptions,
	SentinelOptions,
	TracingOptions,
} from "./types";
import { pageUrl } from "./url";
import { parseUserAgent } from "./useragent";
import { SDK_NAME, SDK_VERSION } from "./version";

export type { ClientDeps };

// Una transacción automática termina tras 1 s sin actividad, y como mucho a los 15 s.
const IDLE_TIMEOUT_MS = 1_000;
const FINAL_TIMEOUT_MS = 15_000;

/** Qué se mide solo; todo apagado si `tracesSampleRate` no es mayor que 0. */
function tracingOptions(options: SentinelOptions): Required<TracingOptions> {
	const on = (options.tracesSampleRate ?? 0) > 0;
	const t = options.tracing;
	const all = { pageload: on, navigation: on, http: on, webVitals: on };
	if (!on || t === undefined || t === true) return all;
	if (t === false)
		return {
			pageload: false,
			navigation: false,
			http: false,
			webVitals: false,
		};
	return { ...all, ...t };
}

function browserPlatform(options: SentinelOptions): Platform {
	return {
		name: "javascript",
		sdk: { name: SDK_NAME, version: SDK_VERSION },
		createTracer: ({ onFinish, ...parts }) =>
			new BrowserTracer(
				{
					...parts,
					...tracingOptions(options),
					idleTimeoutMs: IDLE_TIMEOUT_MS,
					finalTimeoutMs: FINAL_TIMEOUT_MS,
				},
				{ onFinish },
			),
		eventExtras() {
			const url = pageUrl(options.sendFullUrl ?? false);
			const ua =
				typeof navigator !== "undefined" ? navigator.userAgent : undefined;
			const parsed = parseUserAgent(ua);
			return {
				...((url || ua) && {
					request: {
						...(url && { url }),
						...(ua && { headers: { "User-Agent": ua } }),
					},
				}),
				contexts: {
					...(parsed.browser && { browser: parsed.browser }),
					...(parsed.os && { os: parsed.os }),
					...(typeof window !== "undefined" && {
						viewport: { width: window.innerWidth, height: window.innerHeight },
					}),
				},
			};
		},
		pageOrigin: () =>
			typeof location !== "undefined" ? location.origin : undefined,
		// La consola puede estar parchada para breadcrumbs: se usa la original para no entrar en bucle.
		log: (message) => originalConsole?.warn?.(message),
	};
}

export class SentinelClient extends CoreClient<SentinelOptions> {
	constructor(options: SentinelOptions, deps: ClientDeps = {}) {
		super(options, deps, browserPlatform(options));
	}

	/** Engancha los handlers globales y la instrumentación de breadcrumbs. */
	install(): this {
		if (!this.enabled || this.installed || typeof window === "undefined")
			return this;
		this.installed = true;
		const add = (b: Breadcrumb) => this.addBreadcrumb(b);
		const isOwnUrl = this.isOwnUrl;

		if (this.options.captureGlobalErrors !== false) {
			this.uninstallers.push(
				installGlobalHandlers({
					addBreadcrumb: add,
					onError: (error) =>
						this.captureThrown(error, {
							tags: { handled: "false", mechanism: "onerror" },
						}),
					onRejection: (reason) =>
						this.captureThrown(
							reason,
							{ tags: { handled: "false", mechanism: "onunhandledrejection" } },
							{
								nonErrorType: "UnhandledRejection",
								nonErrorPrefix:
									"Non-Error promise rejection captured with value: ",
							},
						),
				}),
			);
		}

		const crumbs = this.breadcrumbOptions();
		if (crumbs.console) this.uninstallers.push(installConsole(add));
		if (crumbs.clicks) this.uninstallers.push(installClicks(add));
		const tracer = this.tracer as BrowserTracer | undefined;
		const traceHttp = tracer?.config.http
			? (info: { method: string; url: string }) => tracer.startHttpSpan(info)
			: undefined;
		if (crumbs.fetch || traceHttp)
			this.uninstallers.push(
				installFetch(crumbs.fetch ? add : () => {}, isOwnUrl, traceHttp),
			);
		if (crumbs.xhr || traceHttp)
			this.uninstallers.push(
				installXhr(crumbs.xhr ? add : () => {}, isOwnUrl, traceHttp),
			);
		const traceNavigation = tracer?.config.navigation
			? (from: string, to: string) => tracer.onNavigation(from, to)
			: undefined;
		if (crumbs.navigation || traceNavigation)
			this.uninstallers.push(
				installNavigation(crumbs.navigation ? add : () => {}, traceNavigation),
			);
		tracer?.startPageload();

		// Si la página se cierra con envíos pendientes de reintento, se usan beacons.
		const onHide = () => this.transport?.flushWithBeacon();
		const onVisibility = () => {
			if (document.visibilityState === "hidden") onHide();
		};
		window.addEventListener("pagehide", onHide);
		document.addEventListener("visibilitychange", onVisibility);
		this.uninstallers.push(() => {
			window.removeEventListener("pagehide", onHide);
			document.removeEventListener("visibilitychange", onVisibility);
		});
		return this;
	}

	private breadcrumbOptions(): Required<BreadcrumbOptions> {
		const all = {
			console: true,
			clicks: true,
			fetch: true,
			xhr: true,
			navigation: true,
		};
		const b = this.options.breadcrumbs;
		if (b === false)
			return {
				console: false,
				clicks: false,
				fetch: false,
				xhr: false,
				navigation: false,
			};
		if (b === true || b === undefined) return all;
		return { ...all, ...b };
	}
}
