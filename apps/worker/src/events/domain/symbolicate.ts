import {
	originalPositionFor,
	sourceContentFor,
	type TraceMap,
} from "@jridgewell/trace-mapping";
import {
	type IngestEvent,
	normalizeArtifactName,
	type StackFrame,
} from "@sentinel/shared";

/** Dado el nombre de un archivo minificado ("~/assets/app.js"), devuelve su source map (si lo hay). */
export type MapResolver = (
	artifactName: string,
) => Promise<TraceMap | undefined>;

const CONTEXT_LINES = 5;
const MAX_CONTEXT_LENGTH = 500;
const MINIFIED_NAME = /^[A-Za-z_$][\w$]?$/; // "a", "ab", "_", "$": nombres típicos de un minificador

/** "webpack:///./src/a.ts", "../../src/a.ts", "file:///x/a.ts?v=1" -> "src/a.ts" */
export function cleanSourcePath(source: string): string {
	return source
		.replace(/^webpack:\/\/[^/]*\//, "")
		.replace(/^file:\/\//, "")
		.split("?", 1)[0]
		.replace(/^(?:\.{1,2}\/)+/, "")
		.replace(/^\/+/, "");
}

/** Código propio de la app: no es una dependencia ni código interno del empaquetador. */
export function isInAppSource(path: string): boolean {
	return (
		!/(^|\/)node_modules\//.test(path) &&
		!/(^|\/)\.pnpm\//.test(path) &&
		!/^(\(webpack\)|webpack\/|vite\/|\.vite\/)/.test(path)
	);
}

// Patrones para encontrar la función que contiene una línea del código original. El mapa
// indica la posición, no el nombre de la función envolvente: se busca hacia atrás.
const FUNCTION_PATTERNS: RegExp[] = [
	/(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)\s*[(<]/,
	/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*(?::[^=]+)?=>/,
	/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?function/,
	/^\s*(?:(?:public|private|protected|static|async|get|set)\s+)*([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*(?::\s*[^{;]+)?\{\s*$/,
];
const NOT_FUNCTIONS = new Set([
	"if",
	"for",
	"while",
	"switch",
	"catch",
	"return",
	"else",
	"do",
	"with",
]);
const LOOKBACK_LINES = 80;

/** Nombre de la función que contiene `line` (1-based), o undefined si no se puede deducir. */
export function enclosingFunctionName(
	lines: string[],
	line: number,
): string | undefined {
	for (
		let i = Math.min(line, lines.length) - 1;
		i >= Math.max(0, line - 1 - LOOKBACK_LINES);
		i--
	) {
		for (const pattern of FUNCTION_PATTERNS) {
			const name = pattern.exec(lines[i])?.[1];
			if (name && !NOT_FUNCTIONS.has(name)) return name;
		}
	}
	return undefined;
}

const clip = (text: string) =>
	text.length > MAX_CONTEXT_LENGTH
		? `${text.slice(0, MAX_CONTEXT_LENGTH - 1)}…`
		: text;

function looksMinified(name: string | undefined): boolean {
	return !name || name === "<anonymous>" || MINIFIED_NAME.test(name);
}

function resolveFrame(
	frame: StackFrame,
	map: TraceMap,
): StackFrame | undefined {
	if (
		frame.lineno === undefined ||
		frame.colno === undefined ||
		!frame.filename
	)
		return undefined;

	// El navegador cuenta las columnas desde 1; el mapa, desde 0.
	const position = originalPositionFor(map, {
		line: frame.lineno,
		column: Math.max(0, frame.colno - 1),
	});
	if (position.source === null || position.line === null) return undefined;

	const filename = cleanSourcePath(position.source);
	const content = sourceContentFor(map, position.source);
	const lines = content?.split(/\r?\n/);

	// Solo se adivina el nombre si el original parece minificado; si no, es el real.
	const guessed =
		lines && looksMinified(frame.function)
			? enclosingFunctionName(lines, position.line)
			: undefined;

	return {
		...frame,
		filename,
		lineno: position.line,
		colno: (position.column ?? 0) + 1,
		// Si no se puede deducir, se deja el nombre minificado: es preferible a mostrar uno incorrecto
		// (el `name` del mapa es el identificador de esa posición, no la función que la contiene).
		function: guessed ?? frame.function,
		abs_path: frame.filename,
		in_app: isInAppSource(filename),
		symbolicated: true,
		...(lines && {
			context_line: clip(lines[position.line - 1] ?? ""),
			pre_context: lines
				.slice(
					Math.max(0, position.line - 1 - CONTEXT_LINES),
					position.line - 1,
				)
				.map(clip),
			post_context: lines
				.slice(position.line, position.line + CONTEXT_LINES)
				.map(clip),
		}),
	};
}

/**
 * Reemplaza los frames minificados por su posición en el código original, usando los source maps
 * de la release del evento. Los frames sin mapa o que no se pueden resolver se dejan como están:
 * simbolizar nunca debe hacer fallar ni perder un evento.
 */
export async function symbolicateEvent(
	event: IngestEvent,
	resolve: MapResolver,
): Promise<IngestEvent> {
	if (!event.exception || !event.release) return event;

	// Se guarda la promesa (no el resultado): los frames se resuelven en paralelo y así
	// cada archivo se busca una sola vez.
	const cache = new Map<string, Promise<TraceMap | undefined>>();
	const mapFor = async (filename: string | undefined) => {
		const name = filename ? normalizeArtifactName(filename) : null;
		if (!name) return undefined;
		let pending = cache.get(name);
		if (!pending) {
			pending = resolve(name);
			cache.set(name, pending);
		}
		return pending;
	};

	const values = await Promise.all(
		event.exception.values.map(async (value) => {
			if (!value.stacktrace) return value;
			const frames = await Promise.all(
				value.stacktrace.frames.map(async (frame) => {
					if (frame.symbolicated) return frame;
					const map = await mapFor(frame.filename);
					return (map && resolveFrame(frame, map)) || frame;
				}),
			);
			return { ...value, stacktrace: { ...value.stacktrace, frames } };
		}),
	);
	return { ...event, exception: { values } };
}
