import type { SentinelEvent, SentinelTransaction } from "./types";

export interface TransportOptions {
	endpoint: string;
	/** Destino de las transacciones; sin él, solo se envían eventos. */
	transactionsEndpoint?: string;
	publicKey: string;
	/** Inyectable para pruebas. Por defecto `fetch` global. */
	fetchImpl?: typeof fetch;
	maxRetries?: number;
	/** Esperas entre reintentos (ms). */
	retryDelays?: number[];
	onDebug?: (message: string) => void;
}

const KEEPALIVE_LIMIT = 60_000; // fetch con keepalive admite hasta 64 KB.
const DEFAULT_PAUSE_MS = 60_000;

export class Transport {
	private readonly fetchImpl: typeof fetch | undefined;
	private readonly maxRetries: number;
	private readonly retryDelays: number[];
	private pausedUntil = 0;
	private inflight = new Set<Promise<boolean>>();
	/** Cuerpos esperando un reintento; si la página se cierra, se mandan con sendBeacon. */
	private waiting = new Set<{ url: string; body: string }>();

	constructor(private readonly options: TransportOptions) {
		this.fetchImpl =
			options.fetchImpl ??
			(typeof fetch === "function" ? fetch.bind(globalThis) : undefined);
		this.maxRetries = options.maxRetries ?? 3;
		this.retryDelays = options.retryDelays ?? [1_000, 3_000, 8_000];
	}

	/** Envía un evento. Resuelve true si el servidor lo aceptó. Nunca rechaza. */
	send(event: SentinelEvent): Promise<boolean> {
		return this.enqueue(this.options.endpoint, event);
	}

	/** Envía una transacción (rendimiento). Mismas garantías que `send`. */
	sendTransaction(transaction: SentinelTransaction): Promise<boolean> {
		const url = this.options.transactionsEndpoint;
		return url ? this.enqueue(url, transaction) : Promise.resolve(false);
	}

	private enqueue(url: string, payload: unknown): Promise<boolean> {
		const promise = this.deliver(url, JSON.stringify(payload)).catch(
			() => false,
		);
		this.inflight.add(promise);
		promise.finally(() => this.inflight.delete(promise));
		return promise;
	}

	/** Espera a que terminen los envíos pendientes (con tiempo máximo). */
	async flush(timeoutMs = 2_000): Promise<boolean> {
		if (this.inflight.size === 0) return true;
		const all = Promise.all([...this.inflight]).then(() => true);
		const timeout = new Promise<boolean>((resolve) =>
			setTimeout(() => resolve(false), timeoutMs),
		);
		return Promise.race([all, timeout]);
	}

	/** Al cerrarse la página: lo que sigue pendiente de reintento se manda con sendBeacon. */
	flushWithBeacon(): void {
		if (
			typeof navigator === "undefined" ||
			typeof navigator.sendBeacon !== "function"
		)
			return;
		for (const { url, body } of this.waiting) {
			try {
				navigator.sendBeacon(
					`${url}?sentinel_key=${this.options.publicKey}`,
					new Blob([body], { type: "application/json" }),
				);
			} catch {}
		}
		this.waiting.clear();
	}

	private async deliver(
		url: string,
		body: string,
		attempt = 0,
	): Promise<boolean> {
		if (!this.fetchImpl) return false;
		if (Date.now() < this.pausedUntil) {
			this.options.onDebug?.("event dropped: sending is paused (rate limited)");
			return false;
		}

		try {
			const res = await this.fetchImpl(url, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"X-Sentinel-Key": this.options.publicKey,
				},
				body,
				keepalive: body.length < KEEPALIVE_LIMIT,
				mode: "cors",
				credentials: "omit",
			});

			if (res.ok) return true;

			if (res.status === 429) {
				const retryAfter = Number(res.headers.get("Retry-After"));
				const ms =
					Number.isFinite(retryAfter) && retryAfter > 0
						? retryAfter * 1_000
						: DEFAULT_PAUSE_MS;
				this.pausedUntil = Date.now() + ms;
				this.options.onDebug?.(
					`rate limited by the server, pausing for ${Math.round(ms / 1_000)}s`,
				);
				return false;
			}
			if (res.status >= 400 && res.status < 500) {
				this.options.onDebug?.(`event rejected by the server (${res.status})`);
				return false;
			}
			// 5xx: reintentar.
		} catch {
			// Error de red: reintentar.
		}

		if (attempt >= this.maxRetries) {
			this.options.onDebug?.("event dropped after retries");
			return false;
		}
		const delay =
			this.retryDelays[Math.min(attempt, this.retryDelays.length - 1)];
		const pending = { url, body };
		this.waiting.add(pending);
		await new Promise((resolve) => setTimeout(resolve, delay));
		if (!this.waiting.delete(pending)) return false; // ya se mandó con sendBeacon
		return this.deliver(url, body, attempt + 1);
	}
}
