import type { StackFrame } from "@sentinel/shared";

export interface DisplayFrame extends StackFrame {
	/** Posición original en la lista del servidor (más antiguo = 0). */
	index: number;
}

export interface CodeLine {
	number: number;
	text: string;
	highlight: boolean;
}
