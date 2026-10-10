import type { SentinelEvent } from "./types";

// Límites que acepta el servidor (packages/shared/src/ingest.ts). Si se exceden,
// el evento completo sería rechazado, así que el SDK recorta en lugar de fallar.
export const LIMITS = {
	short: 256,
	medium: 2_048,
	long: 16_384,
	frames: 250,
	exceptionValues: 10,
	breadcrumbs: 100,
	tagKey: 64,
	tagValue: 512,
	fingerprint: 10,
	/** El servidor corta en 1 MB; dejamos margen. */
	maxBytes: 900_000,
};

export function truncate(value: string, max: number): string {
	return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

/**
 * Convierte cualquier valor en algo serializable a JSON: maneja ciclos, funciones,
 * bigint, Error, nodos del DOM y limita profundidad y tamaño.
 */
export function safeSerialize(
	value: unknown,
	depth = 3,
	maxString = 1_000,
): unknown {
	const seen = new WeakSet<object>();

	const walk = (v: unknown, remaining: number): unknown => {
		if (v === null || v === undefined) return v;
		switch (typeof v) {
			case "string":
				return truncate(v, maxString);
			case "number":
				return Number.isFinite(v) ? v : String(v);
			case "boolean":
				return v;
			case "bigint":
				return `${v}n`;
			case "symbol":
				return v.toString();
			case "function":
				return `[Function ${(v as { name?: string }).name || "anonymous"}]`;
		}
		const obj = v as object;
		if (typeof Element !== "undefined" && obj instanceof Element) {
			return `[Element ${obj.tagName.toLowerCase()}]`;
		}
		if (seen.has(obj)) return "[Circular]";
		if (remaining <= 0) return Array.isArray(obj) ? "[Array]" : "[Object]";
		seen.add(obj);

		if (obj instanceof Error) {
			return { name: obj.name, message: truncate(obj.message, maxString) };
		}
		if (obj instanceof Date) {
			return Number.isNaN(obj.getTime()) ? "Invalid Date" : obj.toISOString();
		}
		if (Array.isArray(obj)) {
			return obj.slice(0, 20).map((item) => walk(item, remaining - 1));
		}
		const out: Record<string, unknown> = {};
		for (const key of Object.keys(obj).slice(0, 30)) {
			try {
				out[key] = walk((obj as Record<string, unknown>)[key], remaining - 1);
			} catch {
				out[key] = "[Unreadable]";
			}
		}
		return out;
	};

	try {
		return walk(value, depth);
	} catch {
		return "[Unserializable]";
	}
}

/** Texto corto y legible de cualquier valor (para mensajes y breadcrumbs). */
export function stringify(value: unknown, max = 1_000): string {
	if (typeof value === "string") return truncate(value, max);
	const serialized = safeSerialize(value, 2, 200);
	if (typeof serialized === "string") return truncate(serialized, max);
	try {
		return truncate(JSON.stringify(serialized) ?? String(serialized), max);
	} catch {
		return "[Unserializable]";
	}
}

function jsonSize(value: unknown): number {
	try {
		return JSON.stringify(value).length;
	} catch {
		return Number.POSITIVE_INFINITY;
	}
}

/** Ajusta el evento a los límites del servidor sin lanzar nunca. */
export function normalizeEvent(event: SentinelEvent): SentinelEvent {
	const e: SentinelEvent = { ...event };

	if (e.release) e.release = truncate(e.release, LIMITS.short);
	if (e.environment) e.environment = truncate(e.environment, LIMITS.short);
	if (e.platform) e.platform = truncate(e.platform, LIMITS.short);
	if (e.message) e.message = truncate(e.message, LIMITS.long);

	if (e.exception) {
		e.exception = {
			values: e.exception.values.slice(-LIMITS.exceptionValues).map((v) => ({
				type: truncate(v.type || "Error", LIMITS.short),
				...(v.value !== undefined && { value: truncate(v.value, LIMITS.long) }),
				...(v.stacktrace && {
					stacktrace: {
						frames: v.stacktrace.frames.slice(-LIMITS.frames).map((f) => ({
							...f,
							...(f.filename && {
								filename: truncate(f.filename, LIMITS.medium),
							}),
							...(f.function && {
								function: truncate(f.function, LIMITS.short),
							}),
							...(f.module && { module: truncate(f.module, LIMITS.short) }),
						})),
					},
				}),
			})),
		};
	}

	if (e.fingerprint) {
		e.fingerprint = e.fingerprint
			.slice(0, LIMITS.fingerprint)
			.map((f) => truncate(String(f), LIMITS.short));
	}

	if (e.user) {
		const u = e.user;
		e.user = {
			...(u.id !== undefined && { id: truncate(String(u.id), LIMITS.short) }),
			...(u.email && { email: truncate(u.email, LIMITS.short) }),
			...(u.username && { username: truncate(u.username, LIMITS.short) }),
			...(u.ip_address && { ip_address: truncate(u.ip_address, LIMITS.short) }),
		};
	}

	if (e.tags) {
		e.tags = Object.fromEntries(
			Object.entries(e.tags).map(([k, v]) => [
				truncate(k, LIMITS.tagKey),
				truncate(String(v), LIMITS.tagValue),
			]),
		);
	}

	if (e.request) {
		const r = e.request;
		e.request = {
			...(r.url && { url: truncate(r.url, LIMITS.medium) }),
			...(r.method && { method: truncate(r.method, 16) }),
			...(r.headers && {
				headers: Object.fromEntries(
					Object.entries(r.headers).map(([k, v]) => [
						k,
						truncate(String(v), 1_024),
					]),
				),
			}),
		};
	}

	if (e.contexts) {
		e.contexts = safeSerialize(e.contexts, 3) as SentinelEvent["contexts"];
	}
	if (e.extra) {
		e.extra = safeSerialize(e.extra, 4) as SentinelEvent["extra"];
	}

	if (e.breadcrumbs) {
		e.breadcrumbs = e.breadcrumbs.slice(-LIMITS.breadcrumbs).map((b) => ({
			...b,
			...(b.category && { category: truncate(b.category, LIMITS.short) }),
			...(b.type && { type: truncate(b.type, LIMITS.short) }),
			...(b.message && { message: truncate(b.message, LIMITS.medium) }),
			...(b.data && {
				data: safeSerialize(b.data, 2) as Record<string, unknown>,
			}),
		}));
	}

	// Tope de tamaño: sacrificamos primero lo menos importante.
	if (jsonSize(e) > LIMITS.maxBytes) delete e.extra;
	if (jsonSize(e) > LIMITS.maxBytes) delete e.contexts;
	if (e.breadcrumbs && jsonSize(e) > LIMITS.maxBytes) {
		e.breadcrumbs = e.breadcrumbs
			.slice(-10)
			.map(({ data: _data, ...rest }) => rest);
	}
	if (jsonSize(e) > LIMITS.maxBytes) delete e.breadcrumbs;

	return e;
}
