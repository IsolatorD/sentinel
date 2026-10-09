/** Caché pequeña con caducidad y tope de tamaño (descarta lo más antiguo). */
export class TtlCache<V> {
	private readonly entries = new Map<string, { value: V; expiresAt: number }>();

	constructor(
		private readonly maxEntries: number,
		private readonly now: () => number = Date.now,
	) {}

	get(key: string): { value: V } | undefined {
		const entry = this.entries.get(key);
		if (!entry) return undefined;
		if (entry.expiresAt <= this.now()) {
			this.entries.delete(key);
			return undefined;
		}
		return { value: entry.value };
	}

	set(key: string, value: V, ttlMs: number): void {
		this.entries.delete(key);
		this.entries.set(key, { value, expiresAt: this.now() + ttlMs });
		if (this.entries.size > this.maxEntries) {
			const oldest = this.entries.keys().next().value;
			if (oldest !== undefined) this.entries.delete(oldest);
		}
	}
}
