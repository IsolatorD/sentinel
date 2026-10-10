import type { SentinelEvent } from "./types";

export type Pattern = string | RegExp;

export const DEFAULT_IGNORE_ERRORS: RegExp[] = [
	// Errores de otro origen sin información útil.
	/^Script error\.?$/,
	/^Javascript error: Script error\.? on line 0$/,
	// Aviso inofensivo de los navegadores, no un fallo real.
	/ResizeObserver loop (?:limit exceeded|completed with undelivered notifications)/,
];

function matches(text: string, patterns: Pattern[]): boolean {
	return patterns.some((p) =>
		typeof p === "string" ? text.includes(p) : p.test(text),
	);
}

function candidates(event: SentinelEvent): string[] {
	const out: string[] = [];
	if (event.message) out.push(event.message);
	for (const v of event.exception?.values ?? []) {
		out.push(v.type);
		if (v.value) {
			out.push(v.value);
			out.push(`${v.type}: ${v.value}`);
		}
	}
	return out;
}

export function isIgnoredError(
	event: SentinelEvent,
	patterns: Pattern[],
): boolean {
	return candidates(event).some((c) => matches(c, patterns));
}

function frameUrls(event: SentinelEvent): string[] {
	return (event.exception?.values ?? [])
		.flatMap((v) => v.stacktrace?.frames ?? [])
		.map((f) => f.filename)
		.filter((f): f is string => Boolean(f));
}

export function isDeniedUrl(event: SentinelEvent, deny: Pattern[]): boolean {
	return deny.length > 0 && frameUrls(event).some((u) => matches(u, deny));
}

/** Con `allowUrls`, solo pasan errores con algún frame en esas URLs (los mensajes sin stack pasan). */
export function isAllowedUrl(event: SentinelEvent, allow: Pattern[]): boolean {
	if (allow.length === 0) return true;
	const urls = frameUrls(event);
	return urls.length === 0 || urls.some((u) => matches(u, allow));
}
