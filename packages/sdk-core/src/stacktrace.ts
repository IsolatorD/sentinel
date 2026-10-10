import type { StackFrame } from "./types";

const MAX_FRAMES = 250;

function parseLocation(
	location: string,
): Pick<StackFrame, "filename" | "lineno" | "colno"> {
	const match = /^(.*?):(\d+)(?::(\d+))?$/.exec(location);
	if (!match) return { filename: location || undefined };
	return {
		filename: match[1],
		lineno: Number(match[2]),
		colno: match[3] !== undefined ? Number(match[3]) : undefined,
	};
}

function parseV8Line(line: string): StackFrame | undefined {
	let rest = line.replace(/^\s*at\s+/, "").replace(/^async\s+/, "");
	let fn: string | undefined;
	const withFn = /^(.*?)\s+\((.*)\)$/.exec(rest);
	if (withFn) {
		fn = withFn[1];
		rest = withFn[2];
	}
	// Hermes: "at fn (address at index.android.bundle:1:2345)"; "native" no es un archivo.
	rest = rest.replace(/^address at /, "");
	// "eval at foo (http://x/a.js:1:2), <anonymous>:1:1": nos quedamos con lo útil.
	if (rest.startsWith("eval at ")) rest = "<anonymous>";
	return { function: fn || undefined, ...parseLocation(rest) };
}

function parseGeckoLine(line: string): StackFrame | undefined {
	const match = /^(.*?)@(.*)$/.exec(line.trim());
	if (!match) return undefined;
	const [, fn, location] = match;
	if (!fn && !location) return undefined;
	return { function: fn || undefined, ...parseLocation(location) };
}

/** ¿El archivo es código de la app (y no una librería, una extensión o código nativo)? */
export function isInApp(
	filename: string | undefined,
	pageOrigin?: string,
): boolean {
	if (!filename) return false;
	// Código nativo, eval y los módulos internos de Node (`node:internal/...`).
	if (/^(?:<|\[native|native$|node:)/.test(filename)) return false;
	if (/node_modules/.test(filename)) return false;
	if (/^(?:chrome|moz|safari|webkit)(?:-web)?-?extension:/i.test(filename))
		return false;
	if (/^(?:extensions?|resource):\/\//i.test(filename)) return false;
	if (pageOrigin && /^https?:\/\//i.test(filename)) {
		try {
			return new URL(filename).origin === pageOrigin;
		} catch {
			return false;
		}
	}
	return true;
}

/**
 * Convierte `error.stack` (formato V8 o Firefox/Safari) en frames ordenados del más
 * antiguo al más reciente, como espera el servidor.
 */
export function parseStack(
	stack: string | undefined,
	pageOrigin?: string,
): StackFrame[] {
	if (!stack) return [];
	const frames: StackFrame[] = [];

	for (const raw of stack.split("\n")) {
		const line = raw.trim();
		if (!line) continue;
		const frame = /^at\s/.test(line) ? parseV8Line(line) : parseGeckoLine(line);
		if (!frame) continue;
		frame.in_app = isInApp(frame.filename, pageOrigin);
		frames.push(frame);
	}

	// El stack lista primero el frame más reciente: lo invertimos.
	return frames.reverse().slice(-MAX_FRAMES);
}
