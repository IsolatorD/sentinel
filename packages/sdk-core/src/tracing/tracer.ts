import { stripQuery } from "../url";
import { GlobalTraceContext, type TraceContext } from "./context";
import { type Clock, Span } from "./span";
import { formatTraceparent } from "./traceparent";
import { Transaction } from "./transaction";

export interface TracerConfig {
	/** Fracción de transacciones que se registran (0 a 1). */
	sampleRate: number;
	/** Crea un span por cada petición HTTP saliente. */
	http: boolean;
	/** A qué URLs se añade la cabecera `traceparent`. */
	propagationTargets?: Array<string | RegExp>;
	maxSpans: number;
	idleTimeoutMs: number;
	finalTimeoutMs: number;
}

export interface TracerDeps {
	clock?: Clock;
	random?: () => number;
	context?: TraceContext;
	/** Recibe cada transacción muestreada al terminar. */
	onFinish: (tx: Transaction) => void;
}

export interface StartTransactionContext {
	name: string;
	op?: string;
	startTimestamp?: number;
	/** Si es `true`, termina sola cuando deja de haber actividad. */
	idle?: boolean;
	/** Continúa una traza que viene de fuera (cabecera `traceparent`). */
	traceId?: string;
	parentSpanId?: string;
	/** Decisión ya tomada por quien originó la traza; si se omite, se muestrea con `sampleRate`. */
	sampled?: boolean;
	/** Se llama justo antes de cerrarla (uso interno: añadir los Web Vitals). */
	beforeFinish?: (tx: Transaction) => void;
}

/** Lo que la instrumentación de peticiones HTTP recibe al empezar una. */
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

export { statusFromHttp };

const isPromiseLike = (v: unknown): v is PromiseLike<unknown> =>
	typeof (v as PromiseLike<unknown> | undefined)?.then === "function";

export class Tracer {
	protected readonly clock: Clock;
	private readonly random: () => number;
	readonly context: TraceContext;

	constructor(
		readonly config: TracerConfig,
		protected readonly deps: TracerDeps,
	) {
		this.clock = deps.clock ?? Date.now;
		this.random = deps.random ?? Math.random;
		this.context = deps.context ?? new GlobalTraceContext();
	}

	/** La transacción en curso, a la que se añaden los spans. */
	get active(): Transaction | undefined {
		const tx = this.context.get();
		return tx && !tx.finished ? tx : undefined;
	}

	startTransaction(ctx: StartTransactionContext): Transaction {
		const tx = this.createTransaction(ctx);
		this.context.enter(tx);
		return tx;
	}

	/**
	 * Como `startTransaction`, pero la transacción solo es "la en curso" dentro de `fn` (y de lo
	 * asíncrono que arranque): lo que necesita un servidor, donde hay una por petición.
	 */
	runTransaction<T>(
		ctx: StartTransactionContext,
		fn: (tx: Transaction) => T,
	): T {
		const tx = this.createTransaction(ctx);
		return this.context.run(tx, () => fn(tx));
	}

	protected createTransaction(ctx: StartTransactionContext): Transaction {
		return new Transaction({
			name: ctx.name,
			op: ctx.op ?? "custom",
			startMs: ctx.startTimestamp ?? this.clock(),
			sampled: ctx.sampled ?? this.random() < this.config.sampleRate,
			maxSpans: this.config.maxSpans,
			clock: this.clock,
			traceId: ctx.traceId,
			parentSpanId: ctx.parentSpanId,
			idle: ctx.idle
				? {
						idleTimeoutMs: this.config.idleTimeoutMs,
						finalTimeoutMs: this.config.finalTimeoutMs,
					}
				: undefined,
			beforeFinish: ctx.beforeFinish,
			onFinish: (finished) => {
				if (this.context.get() === finished) this.context.enter(undefined);
				this.onTransactionFinished(finished);
				if (finished.sampled) this.deps.onFinish(finished);
			},
		});
	}

	/** Gancho para subclases (p. ej. olvidar la transacción automática que acaba de terminar). */
	protected onTransactionFinished(_tx: Transaction): void {}

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
			{ method: info.method, url: clean },
		);
		return {
			headers: this.shouldPropagate(info.url)
				? { traceparent: formatTraceparent(tx.traceId, span.spanId) }
				: undefined,
			end: (statusCode) => {
				if (statusCode !== undefined)
					span.setData("http.status_code", statusCode);
				span.end(statusFromHttp(statusCode));
			},
		};
	}

	/** Termina lo que esté en curso. */
	destroy(): void {
		this.active?.finish();
	}

	/** Cómo se muestra la URL de una petición en la descripción del span. */
	protected describeUrl(url: string): string {
		try {
			const parsed = new URL(url);
			return `${parsed.origin}${parsed.pathname}`;
		} catch {
			return url;
		}
	}

	/** ¿Se añade `traceparent` a esta URL? Solo a las de `propagationTargets`. */
	protected shouldPropagate(url: string): boolean {
		const targets = this.config.propagationTargets;
		if (!targets) return false;
		let href: string;
		try {
			href = new URL(url).href;
		} catch {
			return false;
		}
		return targets.some((t) =>
			typeof t === "string" ? href.includes(t) : t.test(href),
		);
	}
}
