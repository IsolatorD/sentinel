import type { Transaction } from "./transaction";

/**
 * Dónde vive "la transacción en curso". En un navegador hay una sola (variable global); en un
 * servidor hay una por petición, así que Node lo implementa con `AsyncLocalStorage`.
 */
export interface TraceContext {
	get(): Transaction | undefined;
	/** La fija para lo que siga en la ejecución actual (y sus continuaciones asíncronas). */
	enter(tx: Transaction | undefined): void;
	/** Ejecuta `fn` con `tx` como transacción en curso. */
	run<T>(tx: Transaction, fn: () => T): T;
}

/** Una sola transacción en curso para todo el proceso: lo que necesita un navegador. */
export class GlobalTraceContext implements TraceContext {
	private current?: Transaction;
	get() {
		return this.current;
	}
	enter(tx: Transaction | undefined) {
		this.current = tx;
	}
	run<T>(tx: Transaction, fn: () => T): T {
		this.current = tx;
		return fn();
	}
}
