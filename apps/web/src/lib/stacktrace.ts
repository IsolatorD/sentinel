import type { StackFrame } from "@sentinel/shared";

export interface DisplayFrame extends StackFrame {
	/** Posición original en la lista del servidor (más antiguo = 0). */
	index: number;
}

/**
 * El servidor guarda los frames del más antiguo al más reciente; en pantalla se muestra
 * primero donde se lanzó el error. Sin `showAll`, solo el código propio de la app
 * (`in_app`); si ninguno lo es, se muestran todos para no dejar la pila vacía.
 */
export function framesForDisplay(
	frames: StackFrame[],
	showAll: boolean,
): { frames: DisplayFrame[]; hidden: number } {
	const all: DisplayFrame[] = frames
		.map((f, index) => ({ ...f, index }))
		.reverse();
	const inApp = all.filter((f) => f.in_app);
	if (showAll || inApp.length === 0) return { frames: all, hidden: 0 };
	return { frames: inApp, hidden: all.length - inApp.length };
}

/**
 * `Cart.js:42:17` a partir de la URL completa. Si el frame viene de un source map,
 * `filename` ya es la ruta del proyecto (`src/cart.ts`) y se muestra entera.
 */
export function shortLocation(frame: StackFrame): string {
	const file = frame.symbolicated
		? frame.filename
		: frame.filename?.split(/[?#]/, 1)[0].split("/").pop() || frame.filename;
	const name = file || "?";
	const line = frame.lineno !== undefined ? `:${frame.lineno}` : "";
	const col = frame.colno !== undefined ? `:${frame.colno}` : "";
	return `${name}${line}${col}`;
}

export interface CodeLine {
	number: number;
	text: string;
	highlight: boolean;
}

/** Líneas de código alrededor de la que falló, numeradas; vacío si el frame no trae contexto. */
export function contextLines(frame: StackFrame): CodeLine[] {
	const { lineno, context_line: current } = frame;
	if (current === undefined || lineno === undefined) return [];
	const pre = frame.pre_context ?? [];
	const post = frame.post_context ?? [];
	const first = lineno - pre.length;
	return [
		...pre.map((text, i) => ({ number: first + i, text, highlight: false })),
		{ number: lineno, text: current, highlight: true },
		...post.map((text, i) => ({
			number: lineno + 1 + i,
			text,
			highlight: false,
		})),
	];
}
