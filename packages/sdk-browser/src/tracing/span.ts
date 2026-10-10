import { randomHex } from "./ids";

export type Clock = () => number;

/** Un tramo de trabajo dentro de una transacción (una petición, una consulta, un render...). */
export class Span {
	readonly spanId = randomHex(8);
	readonly data: Record<string, unknown> = {};
	status?: string;
	endMs?: number;

	constructor(
		readonly op: string,
		readonly description: string | undefined,
		readonly parentSpanId: string,
		readonly startMs: number,
		private readonly clock: Clock,
		private readonly onEnd?: (span: Span) => void,
		data?: Record<string, unknown>,
	) {
		if (data) Object.assign(this.data, data);
	}

	get finished(): boolean {
		return this.endMs !== undefined;
	}

	setData(key: string, value: unknown): this {
		this.data[key] = value;
		return this;
	}

	setStatus(status: string): this {
		this.status = status;
		return this;
	}

	/** Termina el span. Llamarlo otra vez no hace nada. */
	end(status?: string, endMs: number = this.clock()): void {
		if (this.finished) return;
		if (status) this.status = status;
		this.endMs = Math.max(endMs, this.startMs);
		this.onEnd?.(this);
	}
}
