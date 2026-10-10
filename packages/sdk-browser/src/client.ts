import { BreadcrumbBuffer } from "./breadcrumbs";
import { type ParsedDsn, parseDsn } from "./dsn";
import { exceptionFromUnknown } from "./exception";
import {
	DEFAULT_IGNORE_ERRORS,
	isAllowedUrl,
	isDeniedUrl,
	isIgnoredError,
} from "./filters";
import { installClicks } from "./instrumentation/clicks";
import { installConsole, originalConsole } from "./instrumentation/console";
import { installFetch } from "./instrumentation/fetch";
import { installGlobalHandlers } from "./instrumentation/global-handlers";
import { installNavigation } from "./instrumentation/navigation";
import type { Uninstall } from "./instrumentation/types";
import { installXhr } from "./instrumentation/xhr";
import { normalizeEvent, safeSerialize } from "./normalize";
import { transactionPayload } from "./tracing/payload";
import { Span } from "./tracing/span";
import { type StartTransactionContext, Tracer } from "./tracing/tracer";
import type { Transaction } from "./tracing/transaction";
import { Transport, type TransportOptions } from "./transport";
import type {
	Breadcrumb,
	BreadcrumbOptions,
	CaptureHint,
	Level,
	SentinelEvent,
	SentinelOptions,
	TracingOptions,
	User,
} from "./types";
import { pageUrl } from "./url";
import { parseUserAgent } from "./useragent";
import { uuid } from "./uuid";
import { SDK_NAME, SDK_VERSION } from "./version";

const DEDUPE_WINDOW_MS = 1_000;
const RATE_WINDOW_MS = 60_000;
// Una transacción automática termina tras 1 s sin actividad, y como mucho a los 15 s.
const IDLE_TIMEOUT_MS = 1_000;
const FINAL_TIMEOUT_MS = 15_000;

interface Scope {
	user?: User;
	tags: Record<string, string>;
	contexts: Record<string, Record<string, unknown>>;
	extra: Record<string, unknown>;
}

/** Span que no registra nada: lo que recibe `trace()` cuando el SDK está desactivado. */
const NOOP_SPAN = new Span("noop", undefined, "", 0, () => 0);

export interface ClientDeps {
	/** Para pruebas: reemplaza el `fetch` usado por el transporte. */
	fetchImpl?: TransportOptions["fetchImpl"];
	retryDelays?: number[];
}

export class SentinelClient {
	readonly options: SentinelOptions;
	private readonly dsn: ParsedDsn | null;
	private readonly transport?: Transport;
	private readonly tracer?: Tracer;
	private readonly breadcrumbs: BreadcrumbBuffer;
	private readonly scope: Scope;
	private readonly uninstallers: Uninstall[] = [];
	private readonly ignorePatterns: Array<string | RegExp>;
	private recentKey?: { key: string; at: number };
	private sentAt: number[] = [];
	private installed = false;

	constructor(options: SentinelOptions, deps: ClientDeps = {}) {
		this.options = options;
		this.dsn = parseDsn(options.dsn);
		this.breadcrumbs = new BreadcrumbBuffer(options.maxBreadcrumbs ?? 50);
		this.ignorePatterns = [
			...DEFAULT_IGNORE_ERRORS,
			...(options.ignoreErrors ?? []),
		];
		this.scope = {
			user: options.user,
			tags: { ...options.tags },
			contexts: {},
			extra: {},
		};

		if (!this.dsn) {
			this.debug("invalid DSN: the SDK is disabled");
			return;
		}
		if (options.enabled === false) return;

		this.transport = new Transport({
			endpoint: this.dsn.endpoint,
			transactionsEndpoint: this.dsn.transactionsEndpoint,
			publicKey: this.dsn.publicKey,
			fetchImpl: deps.fetchImpl,
			retryDelays: deps.retryDelays,
			onDebug: (m) => this.debug(m),
		});

		const tracing = this.tracingOptions();
		this.tracer = new Tracer(
			{
				sampleRate: options.tracesSampleRate ?? 0,
				...tracing,
				propagationTargets: options.tracePropagationTargets,
				maxSpans: Math.min(options.maxSpans ?? 100, 200),
				idleTimeoutMs: IDLE_TIMEOUT_MS,
				finalTimeoutMs: FINAL_TIMEOUT_MS,
			},
			{ onFinish: (tx) => this.sendTransaction(tx) },
		);
	}

	/** Qué se mide solo; todo apagado si `tracesSampleRate` no es mayor que 0. */
	private tracingOptions(): Required<TracingOptions> {
		const on = (this.options.tracesSampleRate ?? 0) > 0;
		const t = this.options.tracing;
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

	/** El SDK solo captura si tiene una DSN válida y no fue desactivado. */
	get enabled(): boolean {
		return this.transport !== undefined;
	}

	// ---------- Instalación ----------

	/** Engancha los handlers globales y la instrumentación de breadcrumbs. */
	install(): this {
		if (!this.enabled || this.installed || typeof window === "undefined")
			return this;
		this.installed = true;
		const add = (b: Breadcrumb) => this.addBreadcrumb(b);
		const endpoint = this.dsn?.endpoint ?? "";
		// Cubre tanto /events como /transactions: el SDK no debe medirse a sí mismo.
		const ownBase = endpoint.replace(/events$/, "");
		const isOwnUrl = (url: string) => url.startsWith(ownBase);

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
		const tracer = this.tracer;
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

	// ---------- API de captura ----------

	captureException(
		thrown: unknown,
		hint: CaptureHint = {},
	): string | undefined {
		return this.captureThrown(thrown, hint);
	}

	captureMessage(
		message: string,
		levelOrHint: Level | CaptureHint = "info",
	): string | undefined {
		const hint =
			typeof levelOrHint === "string" ? { level: levelOrHint } : levelOrHint;
		return this.capture({ level: hint.level ?? "info", message }, hint);
	}

	private captureThrown(
		thrown: unknown,
		hint: CaptureHint,
		exceptionOptions: { nonErrorType?: string; nonErrorPrefix?: string } = {},
	): string | undefined {
		try {
			const values = exceptionFromUnknown(thrown, {
				pageOrigin:
					typeof location !== "undefined" ? location.origin : undefined,
				...exceptionOptions,
			});
			return this.capture(
				{ level: hint.level ?? "error", exception: { values } },
				hint,
			);
		} catch (error) {
			this.debug(`could not capture exception: ${String(error)}`);
			return undefined;
		}
	}

	// ---------- Scope ----------

	addBreadcrumb(crumb: Breadcrumb): void {
		if (!this.enabled) return;
		this.breadcrumbs.add(crumb);
	}

	setUser(user: User | null): void {
		this.scope.user = user ?? undefined;
	}

	setTag(key: string, value: string): void {
		this.scope.tags[key] = value;
	}

	setTags(tags: Record<string, string>): void {
		Object.assign(this.scope.tags, tags);
	}

	setContext(name: string, context: Record<string, unknown> | null): void {
		if (context === null) delete this.scope.contexts[name];
		else this.scope.contexts[name] = context;
	}

	setExtra(key: string, value: unknown): void {
		this.scope.extra[key] = value;
	}

	// ---------- Rendimiento ----------

	/**
	 * Empieza una transacción manual (una operación que quieras medir). Termina con `finish()`.
	 * Mientras está en curso, `startSpan` y las peticiones `fetch`/XHR cuelgan de ella.
	 * Sin `tracesSampleRate` devuelve una transacción que no se registra.
	 */
	startTransaction(context: StartTransactionContext): Transaction | undefined {
		return this.tracer?.startTransaction(context);
	}

	/**
	 * Span dentro de la transacción en curso. Termina con `span.end()`.
	 * `startTimestamp` (ms epoch) permite medir algo que ya empezó.
	 */
	startSpan(
		op: string,
		description?: string,
		data?: Record<string, unknown>,
		startTimestamp?: number,
	): Span | undefined {
		return this.tracer?.startSpan(op, description, data, startTimestamp);
	}

	/** Mide una función, síncrona o async: el span termina con ella, y se marca con error si lanza. */
	trace<T>(
		op: string,
		description: string | undefined,
		fn: (span: Span) => T,
	): T {
		return this.tracer ? this.tracer.trace(op, description, fn) : fn(NOOP_SPAN);
	}

	private sendTransaction(tx: Transaction): void {
		try {
			if (!this.transport) return;
			let payload = transactionPayload(tx, {
				release: this.options.release,
				environment: this.options.environment,
				user: this.scope.user,
				tags: this.scope.tags,
			});
			if (this.options.beforeSendTransaction) {
				try {
					const result = this.options.beforeSendTransaction(payload);
					if (result === null) {
						this.drop("transaction dropped by beforeSendTransaction");
						return;
					}
					if (result) payload = result;
				} catch (error) {
					this.debug(
						`beforeSendTransaction threw, sending the original: ${String(error)}`,
					);
				}
			}
			void this.transport.sendTransaction(payload);
		} catch (error) {
			this.debug(`could not send transaction: ${String(error)}`);
		}
	}

	// ---------- Ciclo de vida ----------

	/** Espera a que se envíen los eventos pendientes. */
	async flush(timeoutMs = 2_000): Promise<boolean> {
		return this.transport ? this.transport.flush(timeoutMs) : true;
	}

	/** Quita toda la instrumentación y envía lo pendiente. */
	async close(timeoutMs = 2_000): Promise<boolean> {
		// Lo que se esté midiendo se cierra y se envía antes de soltar la instrumentación.
		this.tracer?.destroy();
		for (const uninstall of this.uninstallers.splice(0)) {
			try {
				uninstall();
			} catch {}
		}
		this.installed = false;
		return this.flush(timeoutMs);
	}

	// ---------- Núcleo ----------

	private capture(
		partial: Partial<SentinelEvent> & { level: Level },
		hint: CaptureHint,
	): string | undefined {
		try {
			return this.process(partial, hint);
		} catch (error) {
			// El SDK nunca debe romper la app que monitorea.
			this.debug(`could not capture event: ${String(error)}`);
			return undefined;
		}
	}

	private process(
		partial: Partial<SentinelEvent> & { level: Level },
		hint: CaptureHint,
	): string | undefined {
		if (!this.transport) return undefined;

		let event = this.buildEvent(partial, hint);

		if (isIgnoredError(event, this.ignorePatterns))
			return this.drop("ignored by ignoreErrors");
		if (isDeniedUrl(event, this.options.denyUrls ?? []))
			return this.drop("ignored by denyUrls");
		if (!isAllowedUrl(event, this.options.allowUrls ?? []))
			return this.drop("not in allowUrls");

		const sampleRate = this.options.sampleRate ?? 1;
		if (sampleRate < 1 && Math.random() >= sampleRate)
			return this.drop("sampled out");

		if (this.isDuplicate(event))
			return this.drop("duplicate of the previous event");
		if (!this.withinRateLimit())
			return this.drop("per-minute event limit reached");

		if (this.options.beforeSend) {
			try {
				const result = this.options.beforeSend(event, hint);
				if (result === null) return this.drop("dropped by beforeSend");
				if (result) event = result;
			} catch (error) {
				this.debug(
					`beforeSend threw, sending the original event: ${String(error)}`,
				);
			}
		}

		const normalized = normalizeEvent(event);
		void this.transport.send(normalized);
		return normalized.event_id;
	}

	private buildEvent(
		partial: Partial<SentinelEvent> & { level: Level },
		hint: CaptureHint,
	): SentinelEvent {
		const user = { ...this.scope.user, ...hint.user };
		const tags = { ...this.scope.tags, ...hint.tags };
		const extra = { ...this.scope.extra, ...hint.extra };
		const url = pageUrl(this.options.sendFullUrl ?? false);
		const ua =
			typeof navigator !== "undefined" ? navigator.userAgent : undefined;
		const parsed = parseUserAgent(ua);

		const contexts: Record<string, Record<string, unknown>> = {
			sdk: { name: SDK_NAME, version: SDK_VERSION },
			// Une el error con la transacción en curso (se podrá ver el rendimiento del momento del fallo).
			...(this.tracer?.active?.sampled && {
				trace: {
					trace_id: this.tracer.active.traceId,
					span_id: this.tracer.active.spanId,
				},
			}),
			...(parsed.browser && { browser: parsed.browser }),
			...(parsed.os && { os: parsed.os }),
			...(typeof window !== "undefined" && {
				viewport: { width: window.innerWidth, height: window.innerHeight },
			}),
			...this.scope.contexts,
			...hint.contexts,
		};

		const breadcrumbs = this.breadcrumbs.list();

		return {
			event_id: uuid(),
			timestamp: new Date().toISOString(),
			platform: "javascript",
			release: this.options.release,
			environment: this.options.environment,
			...partial,
			...(Object.keys(user).length > 0 && { user }),
			...(Object.keys(tags).length > 0 && { tags }),
			...((url || ua) && {
				request: {
					...(url && { url }),
					...(ua && { headers: { "User-Agent": ua } }),
				},
			}),
			contexts,
			...(breadcrumbs.length > 0 && { breadcrumbs }),
			...(Object.keys(extra).length > 0 && {
				extra: safeSerialize(extra, 4) as Record<string, unknown>,
			}),
			...(hint.fingerprint && { fingerprint: hint.fingerprint }),
		};
	}

	/** Mismo error capturado dos veces seguidas (p. ej. por un ErrorBoundary y por window.onerror). */
	private isDuplicate(event: SentinelEvent): boolean {
		const main = event.exception?.values.at(-1);
		const top = main?.stacktrace?.frames.at(-1);
		const key = [
			event.message,
			main?.type,
			main?.value,
			top?.filename,
			top?.lineno,
			top?.colno,
		].join("|");
		const now = Date.now();
		const dup =
			this.recentKey?.key === key && now - this.recentKey.at < DEDUPE_WINDOW_MS;
		this.recentKey = { key, at: now };
		return dup;
	}

	private withinRateLimit(): boolean {
		const limit = this.options.maxEventsPerMinute ?? 30;
		const now = Date.now();
		this.sentAt = this.sentAt.filter((t) => now - t < RATE_WINDOW_MS);
		if (this.sentAt.length >= limit) return false;
		this.sentAt.push(now);
		return true;
	}

	private drop(reason: string): undefined {
		this.debug(`event dropped: ${reason}`);
		return undefined;
	}

	private debug(message: string): void {
		if (this.options.debug) originalConsole?.warn?.(`[Sentinel] ${message}`);
	}
}
