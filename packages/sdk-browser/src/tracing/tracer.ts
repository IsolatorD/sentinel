import { stripQuery } from "../url";
import { type Clock, Span } from "./span";
import { Transaction } from "./transaction";
import { collectWebVitals } from "./web-vitals";

export interface TracerConfig {
	/** Fracción de transacciones que se registran (0 a 1). */
	sampleRate: number;
	pageload: boolean;
	navigation: boolean;
	http: boolean;
	webVitals: boolean;
	/** A qué URLs se añade la cabecera `traceparent`. Por defecto, solo al mismo origen. */
	propagationTargets?: Array<string | RegExp>;
	maxSpans: number;
	idleTimeoutMs: number;
	finalTimeoutMs: number;
}

export interface TracerDeps {
	clock?: Clock;
	random?: () => number;
	/** Recibe cada transacción muestreada al terminar. */
	onFinish: (tx: Transaction) => void;
}

export interface StartTransactionContext {
	name: string;
	op?: string;
	startTimestamp?: number;
	/** Si es `true`, termina sola cuando deja de haber actividad. */
	idle?: boolean;
	/** Se llama justo antes de cerrarla (uso interno: añadir los Web Vitals). */
	beforeFinish?: (tx: Transaction) => void;
}

/** Lo que la instrumentación de `fetch`/XHR recibe al empezar una petición. */
export interface HttpSpanHandle {
	/** Cabeceras que hay que añadir a la petición para continuar la traza en el servidor. */
	headers?: Record<string, string>;
	/** `statusCode` undefined = la petición falló antes de recibir respuesta. */
	end(statusCode?: number): void;
}

function statusFromHttp(code: number | undefined): string {
	if (code === undefined || code === 0) return "internal_error";
	if (code < 400) return "ok";
	return (
		(
			{
				401: "unauthenticated",
				403: "permission_denied",
				404: "not_found",
				429: "resource_exhausted",
			} as Record<number, string>
		)[code] ?? (code >= 500 ? "internal_error" : "invalid_argument")
	);
}

const isPromiseLike = (v: unknown): v is PromiseLike<unknown> =>
	typeof (v as PromiseLike<unknown> | undefined)?.then === "function";

export class Tracer {
	private readonly clock: Clock;
	private readonly random: () => number;
	private activeTx?: Transaction;
	/** La transacción automática (pageload/navegación) en curso, para cerrarla al navegar. */
	private autoTx?: Transaction;
	private cleanups: Array<() => void> = [];

	constructor(
		readonly config: TracerConfig,
		private readonly deps: TracerDeps,
	) {
		this.clock = deps.clock ?? Date.now;
		this.random = deps.random ?? Math.random;
	}

	/** La transacción en curso, a la que se añaden los spans. */
	get active(): Transaction | undefined {
		return this.activeTx && !this.activeTx.finished ? this.activeTx : undefined;
	}

	startTransaction(ctx: StartTransactionContext): Transaction {
		const tx = new Transaction({
			name: ctx.name,
			op: ctx.op ?? "custom",
			startMs: ctx.startTimestamp ?? this.clock(),
			sampled: this.random() < this.config.sampleRate,
			maxSpans: this.config.maxSpans,
			clock: this.clock,
			idle: ctx.idle
				? {
						idleTimeoutMs: this.config.idleTimeoutMs,
						finalTimeoutMs: this.config.finalTimeoutMs,
					}
				: undefined,
			beforeFinish: ctx.beforeFinish,
			onFinish: (finished) => {
				if (this.activeTx === finished) this.activeTx = undefined;
				if (this.autoTx === finished) this.autoTx = undefined;
				if (finished.sampled) this.deps.onFinish(finished);
			},
		});
		this.activeTx = tx;
		return tx;
	}

	/** Span dentro de la transacción en curso; sin ninguna, devuelve uno que no se registra. */
	startSpan(
		op: string,
		description?: string,
		data?: Record<string, unknown>,
		startMs?: number,
	): Span {
		const tx = this.active;
		if (tx) return tx.startSpan(op, description, data, startMs);
		return new Span(
			op,
			description,
			"",
			startMs ?? this.clock(),
			this.clock,
			undefined,
			data,
		);
	}

	/** Mide una función (síncrona o async): el span termina con ella, y con `error` si lanza. */
	trace<T>(
		op: string,
		description: string | undefined,
		fn: (span: Span) => T,
	): T {
		const span = this.startSpan(op, description);
		try {
			const result = fn(span);
			if (isPromiseLike(result)) {
				return result.then(
					(value) => {
						span.end();
						return value;
					},
					(error) => {
						span.end("internal_error");
						throw error;
					},
				) as T;
			}
			span.end();
			return result;
		} catch (error) {
			span.end("internal_error");
			throw error;
		}
	}

	// ---------- Instrumentación automática ----------

	/** Transacción de la carga de página: desde el inicio de la navegación hasta que la página se asienta. */
	startPageload(): void {
		if (!this.config.pageload || typeof window === "undefined") return;
		const start =
			typeof performance !== "undefined" && performance.timeOrigin
				? performance.timeOrigin
				: this.clock();
		const vitals = this.config.webVitals ? collectWebVitals() : undefined;

		const tx = this.startAuto({
			name: location.pathname || "/",
			op: "pageload",
			startTimestamp: start,
			beforeFinish: (t) => {
				if (!vitals) return;
				for (const [name, m] of Object.entries(vitals.read()))
					t.setMeasurement(name, m.value, m.unit);
				vitals.stop();
			},
		});
		if (vitals) this.cleanups.push(() => vitals.stop());

		// La página no está "lista" hasta el evento load.
		const release = tx.hold();
		if (document.readyState === "complete") release();
		else {
			window.addEventListener("load", release, { once: true });
			this.cleanups.push(() => window.removeEventListener("load", release));
		}

		// Al ocultarse la pestaña no se puede garantizar nada más: se cierra con lo que haya.
		const onHidden = () => {
			if (document.visibilityState === "hidden") this.autoTx?.finish();
		};
		document.addEventListener("visibilitychange", onHidden);
		this.cleanups.push(() =>
			document.removeEventListener("visibilitychange", onHidden),
		);
	}

	/** Cambio de URL sin recargar (SPA): cierra la transacción anterior y abre una de navegación. */
	onNavigation(_from: string, to: string): void {
		if (!this.config.navigation) return;
		let pathname: string;
		try {
			pathname = new URL(to, location.href).pathname;
		} catch {
			return;
		}
		// Solo cambió la query o el hash: sigue siendo la misma pantalla.
		if (this.autoTx && this.autoTx.name === pathname && !this.autoTx.finished)
			return;
		this.autoTx?.finish();
		this.startAuto({ name: pathname, op: "navigation" });
	}

	/** Empieza un span de petición HTTP, o `undefined` si no hay una transacción muestreada. */
	startHttpSpan(info: {
		method: string;
		url: string;
	}): HttpSpanHandle | undefined {
		if (!this.config.http) return undefined;
		const tx = this.active;
		if (!tx?.sampled) return undefined;

		const clean = stripQuery(info.url);
		const span = tx.startSpan(
			"http.client",
			`${info.method} ${this.describeUrl(clean)}`,
			{
				method: info.method,
				url: clean,
			},
		);
		return {
			headers: this.shouldPropagate(info.url)
				? { traceparent: `00-${tx.traceId}-${span.spanId}-01` }
				: undefined,
			end: (statusCode) => {
				if (statusCode !== undefined)
					span.setData("http.status_code", statusCode);
				span.end(statusFromHttp(statusCode));
			},
		};
	}

	/** Termina lo que esté en curso y quita los listeners. */
	destroy(): void {
		this.activeTx?.finish();
		this.autoTx?.finish();
		for (const cleanup of this.cleanups.splice(0)) cleanup();
	}

	private startAuto(ctx: StartTransactionContext): Transaction {
		const tx = this.startTransaction({ ...ctx, idle: true });
		this.autoTx = tx;
		return tx;
	}

	private describeUrl(url: string): string {
		try {
			const parsed = new URL(url, location.href);
			return parsed.origin === location.origin
				? parsed.pathname
				: `${parsed.origin}${parsed.pathname}`;
		} catch {
			return url;
		}
	}

	private shouldPropagate(url: string): boolean {
		let absolute: URL;
		try {
			absolute = new URL(url, location.href);
		} catch {
			return false;
		}
		const targets = this.config.propagationTargets;
		if (!targets) return absolute.origin === location.origin;
		return targets.some((t) =>
			typeof t === "string" ? absolute.href.includes(t) : t.test(absolute.href),
		);
	}
}
