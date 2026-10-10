import { AsyncLocalStorage } from "node:async_hooks";
import type { TraceContext, Transaction } from "@sentinel/core";

/**
 * "La transacción en curso" por petición: un servidor atiende muchas a la vez, así que no puede ser
 * una variable global. `AsyncLocalStorage` la sigue a través de `await`, callbacks y temporizadores.
 */
export class AsyncTraceContext implements TraceContext {
	private readonly storage = new AsyncLocalStorage<{ tx?: Transaction }>();

	get(): Transaction | undefined {
		return this.storage.getStore()?.tx;
	}

	enter(tx: Transaction | undefined): void {
		this.storage.enterWith({ tx });
	}

	run<T>(tx: Transaction, fn: () => T): T {
		return this.storage.run({ tx }, fn);
	}
}
