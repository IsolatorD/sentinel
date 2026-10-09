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

/** `Cart.js:42:17` a partir de la URL completa. */
export function shortLocation(frame: StackFrame): string {
	const file =
		frame.filename?.split(/[?#]/, 1)[0].split("/").pop() ||
		frame.filename ||
		"?";
	const line = frame.lineno !== undefined ? `:${frame.lineno}` : "";
	const col = frame.colno !== undefined ? `:${frame.colno}` : "";
	return `${file}${line}${col}`;
}
