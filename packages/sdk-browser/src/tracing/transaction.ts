import { randomHex } from "./ids";
import { type Clock, Span } from "./span";

export interface IdleOptions {
	/** Sin actividad durante este tiempo, la transacción termina sola. */
	idleTimeoutMs: number;
	/** Tiempo máximo de vida aunque siga habiendo actividad. */
	finalTimeoutMs: number;
}

export interface TransactionOptions {
	name: string;
	op: string;
	startMs: number;
	sampled: boolean;
	maxSpans: number;
	clock: Clock;
	traceId?: string;
	idle?: IdleOptions;
	/** Se llama justo antes de cerrarla (p. ej. para añadir los Web Vitals). */
	beforeFinish?: (tx: Transaction) => void;
	onFinish: (tx: Transaction) => void;
}

export interface Measurement {
	value: number;
	unit?: string;
}

/**
 * Una unidad de trabajo medida (una carga de página, una navegación, una operación manual).
 * Si es "idle", termina sola cuando deja de haber actividad: sin spans abiertos ni retenciones.
 */
export class Transaction {
	readonly traceId: string;
	readonly spanId = randomHex(8);
	readonly startMs: number;
	readonly sampled: boolean;
	readonly op: string;
	readonly tags: Record<string, string> = {};
	readonly measurements: Record<string, Measurement> = {};
	readonly spans: Span[] = [];
	name: string;
	status = "ok";
	endMs?: number;
	/** Droppped spans por superar el máximo. */
	droppedSpans = 0;

	private open = 0;
	private lastActivityMs: number;
	private idleTimer?: ReturnType<typeof setTimeout>;
	private finalTimer?: ReturnType<typeof setTimeout>;

	constructor(private readonly options: TransactionOptions) {
		this.name = options.name;
		this.op = options.op;
		this.startMs = options.startMs;
		this.sampled = options.sampled;
		this.traceId = options.traceId ?? randomHex(16);
		this.lastActivityMs = options.startMs;

		if (options.idle) {
			this.armIdle();
			this.finalTimer = setTimeout(
				() => this.finish("deadline_exceeded"),
				options.idle.finalTimeoutMs,
			);
		}
	}

	get finished(): boolean {
		return this.endMs !== undefined;
	}

	setName(name: string): this {
		this.name = name;
		return this;
	}

	setTag(key: string, value: string): this {
		this.tags[key] = value;
		return this;
	}

	setStatus(status: string): this {
		this.status = status;
		return this;
	}

	setMeasurement(name: string, value: number, unit?: string): this {
		if (Number.isFinite(value))
			this.measurements[name] = { value, ...(unit && { unit }) };
		return this;
	}

	startSpan(
		op: string,
		description?: string,
		data?: Record<string, unknown>,
		startMs?: number,
	): Span {
		const clock = this.options.clock;
		const start = startMs ?? clock();
		if (this.finished)
			return new Span(
				op,
				description,
				this.spanId,
				clock(),
				clock,
				undefined,
				data,
			);

		const span = new Span(
			op,
			description,
			this.spanId,
			start,
			clock,
			(ended) => this.spanEnded(ended),
			data,
		);
		this.open++;
		this.clearIdle();
		if (this.sampled && this.spans.length < this.options.maxSpans)
			this.spans.push(span);
		else this.droppedSpans++;
		return span;
	}

	/** Mantiene viva la transacción hasta que se llame a la función devuelta (p. ej. hasta el evento `load`). */
	hold(): () => void {
		if (this.finished) return () => {};
		this.open++;
		this.clearIdle();
		let released = false;
		return () => {
			if (released) return;
			released = true;
			this.lastActivityMs = Math.max(this.lastActivityMs, this.options.clock());
			this.open = Math.max(0, this.open - 1);
			this.armIdle();
		};
	}

	/** Termina la transacción; los spans que sigan abiertos se cancelan. Llamarlo otra vez no hace nada. */
	finish(status?: string, endMs: number = this.options.clock()): void {
		if (this.finished) return;
		this.clearIdle();
		clearTimeout(this.finalTimer);
		if (status) this.status = status;
		const end = Math.max(endMs, this.startMs);
		for (const span of this.spans) span.end("cancelled", end);
		this.endMs = end;
		try {
			this.options.beforeFinish?.(this);
		} catch {}
		this.options.onFinish(this);
	}

	get durationMs(): number {
		return (this.endMs ?? this.options.clock()) - this.startMs;
	}

	private spanEnded(span: Span) {
		this.lastActivityMs = Math.max(this.lastActivityMs, span.endMs ?? 0);
		this.open = Math.max(0, this.open - 1);
		this.armIdle();
	}

	private armIdle() {
		const idle = this.options.idle;
		if (!idle || this.finished || this.open > 0) return;
		this.clearIdle();
		// Al terminar por inactividad, el fin es el de la última actividad, no el del temporizador.
		this.idleTimer = setTimeout(
			() => this.finish(undefined, this.lastActivityMs),
			idle.idleTimeoutMs,
		);
	}

	private clearIdle() {
		clearTimeout(this.idleTimer);
		this.idleTimer = undefined;
	}
}
