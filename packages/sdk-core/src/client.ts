import { BreadcrumbBuffer } from "./breadcrumbs";
import { type ParsedDsn, parseDsn } from "./dsn";
import { exceptionFromUnknown } from "./exception";
import {
	DEFAULT_IGNORE_ERRORS,
	isAllowedUrl,
	isDeniedUrl,
	isIgnoredError,
} from "./filters";
import { normalizeEvent, safeSerialize } from "./normalize";
import { transactionPayload } from "./tracing/payload";
import { Span } from "./tracing/span";
import {
	type StartTransactionContext,
	type Tracer,
	type TracerDeps,
} from "./tracing/tracer";
import { Transaction } from "./tracing/transaction";
import { Transport, type TransportOptions } from "./transport";
import type {
	Breadcrumb,
	CaptureHint,
	CoreOptions,
	Level,
	SentinelEvent,
	User,
} from "./types";
import { uuid } from "./uuid";

const DEDUPE_WINDOW_MS = 1_000;
const RATE_WINDOW_MS = 60_000;

/** Quita la instrumentación y deja todo como estaba. */
export type Uninstall = () => void;

interface Scope {
	user?: User;
	tags: Record<string, string>;
	contexts: Record<string, Record<string, unknown>>;
	extra: Record<string, unknown>;
}

/** Span que no registra nada: lo que recibe `trace()` cuando el SDK está desactivado. */
const NOOP_SPAN = new Span("noop", undefined, "", 0, () => 0);

/** Transacción que no registra nada (SDK desactivado): el código del usuario sigue funcionando igual. */
const NOOP_TRANSACTION = () =>
	new Transaction({
		name: "noop",
		op: "noop",
		startMs: 0,
		sampled: false,
		maxSpans: 0,
		clock: () => 0,
		onFinish: () => {},
	});

export interface ClientDeps {
	/** Para pruebas: reemplaza el `fetch` usado por el transporte. */
	fetchImpl?: TransportOptions["fetchImpl"];
	retryDelays?: number[];
}

/** Lo que cambia entre un navegador y un servidor Node; el resto del cliente es común. */
export interface Platform {
	/** Valor de `platform` en cada evento (`javascript`, `node`). */
	name: string;
	/** Nombre y versión del SDK, que viajan en `contexts.sdk`. */
	sdk: { name: string; version: string };
	/** Crea el tracer de esta plataforma (en el navegador mide también páginas y navegaciones). */
	createTracer(parts: {
		sampleRate: number;
		propagationTargets?: Array<string | RegExp>;
		maxSpans: number;
		onFinish: TracerDeps["onFinish"];
	}): Tracer;
	/** Datos del entorno que se añaden a cada evento: `request`, y contextos como `browser` o `runtime`. */
	eventExtras(): {
		request?: SentinelEvent["request"];
		contexts?: Record<string, Record<string, unknown>>;
	};
	/** Origen de la página: distingue el código propio de scripts de terceros en los stacks. */
	pageOrigin?(): string | undefined;
	/** Dónde escribir los mensajes de `debug`. Por defecto `console.warn`. */
	log?(message: string): void;
}

/**
 * Cliente común: configuración, alcance (usuario, tags...), cola de envío, filtros, muestreo,
 * deduplicación y rendimiento. Cada plataforma lo extiende con su instalación (handlers globales,
 * instrumentación de peticiones...).
 */
export class CoreClient<O extends CoreOptions = CoreOptions> {
	readonly options: O;
	protected readonly dsn: ParsedDsn | null;
	protected readonly transport?: Transport;
	protected readonly tracer?: Tracer;
	protected readonly breadcrumbs: BreadcrumbBuffer;
	protected readonly scope: Scope;
	protected readonly uninstallers: Uninstall[] = [];
	protected installed = false;
	private readonly ignorePatterns: Array<string | RegExp>;
	private recentKey?: { key: string; at: number };
	private sentAt: number[] = [];

	constructor(
		options: O,
		deps: ClientDeps,
		protected readonly platform: Platform,
	) {
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

		this.tracer = platform.createTracer({
			sampleRate: options.tracesSampleRate ?? 0,
			propagationTargets: options.tracePropagationTargets,
			maxSpans: Math.min(options.maxSpans ?? 100, 200),
			onFinish: (tx) => this.sendTransaction(tx),
		});
	}

	/** El SDK solo captura si tiene una DSN válida y no fue desactivado. */
	get enabled(): boolean {
		return this.transport !== undefined;
	}

	/** Las peticiones del propio SDK (eventos y transacciones) no se miden ni se registran. */
	protected isOwnUrl = (url: string): boolean => {
		const endpoint = this.dsn?.endpoint;
		return endpoint ? url.startsWith(endpoint.replace(/events$/, "")) : false;
	};

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

	/** @internal Lo usan los handlers globales de cada plataforma. */
	captureThrown(
		thrown: unknown,
		hint: CaptureHint,
		exceptionOptions: { nonErrorType?: string; nonErrorPrefix?: string } = {},
	): string | undefined {
		try {
			const values = exceptionFromUnknown(thrown, {
				pageOrigin: this.platform.pageOrigin?.(),
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
	 * Ejecuta `fn` con una transacción nueva como "la en curso" solo dentro de ella (y de lo asíncrono
	 * que arranque): lo que necesita un servidor, donde hay una por petición. No la termina: hay que
	 * llamar a `finish()` cuando acabe el trabajo.
	 */
	runTransaction<T>(
		context: StartTransactionContext,
		fn: (transaction: Transaction) => T,
	): T {
		if (!this.tracer) return fn(NOOP_TRANSACTION());
		return this.tracer.runTransaction(context, fn);
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
				platform: this.platform.name,
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

	protected capture(
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
		const extras = this.platform.eventExtras();

		const contexts: Record<string, Record<string, unknown>> = {
			sdk: this.platform.sdk,
			// Une el error con la transacción en curso (se podrá ver el rendimiento del momento del fallo).
			...(this.tracer?.active?.sampled && {
				trace: {
					trace_id: this.tracer.active.traceId,
					span_id: this.tracer.active.spanId,
				},
			}),
			...extras.contexts,
			...this.scope.contexts,
			...hint.contexts,
		};

		const breadcrumbs = this.breadcrumbs.list();

		return {
			event_id: uuid(),
			timestamp: new Date().toISOString(),
			platform: this.platform.name,
			release: this.options.release,
			environment: this.options.environment,
			...partial,
			...(Object.keys(user).length > 0 && { user }),
			...(Object.keys(tags).length > 0 && { tags }),
			...(extras.request && { request: extras.request }),
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

	protected drop(reason: string): undefined {
		this.debug(`event dropped: ${reason}`);
		return undefined;
	}

	protected debug(message: string): void {
		if (!this.options.debug) return;
		const line = `[Sentinel] ${message}`;
		if (this.platform.log) this.platform.log(line);
		else console.warn(line);
	}
}
