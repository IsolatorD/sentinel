import {
	type Span,
	type StartTransactionContext,
	type Transaction,
} from "@sentinel/core";
import { NodeClient } from "./client";
import { getClient, setClient } from "./hub";
import type {
	Breadcrumb,
	CaptureHint,
	Level,
	NodeOptions,
	User,
} from "./types";

export type {
	Measurement,
	Span,
	StartTransactionContext,
	Transaction,
} from "@sentinel/core";
export { NodeClient as SentinelClient } from "./client";
export {
	expressErrorHandler,
	expressRequestHandler,
	setupFastify,
} from "./integrations";
export type {
	Breadcrumb,
	CaptureHint,
	ExceptionValue,
	Level,
	NodeBreadcrumbOptions,
	NodeOptions,
	NodeTracingOptions,
	SentinelEvent,
	SentinelSpan,
	SentinelTransaction,
	StackFrame,
	User,
} from "./types";
export { SDK_VERSION } from "./version";

/**
 * Inicializa el SDK. Llamar una sola vez, lo antes posible (antes de crear el servidor).
 * Si la DSN es inválida, el SDK queda desactivado y no lanza.
 */
export function init(options: NodeOptions): NodeClient {
	const previous = getClient();
	if (previous) void previous.close();
	const created = new NodeClient(options).install();
	setClient(created);
	return created;
}

export { getClient };

export function captureException(
	thrown: unknown,
	hint?: CaptureHint,
): string | undefined {
	return getClient()?.captureException(thrown, hint);
}

export function captureMessage(
	message: string,
	levelOrHint?: Level | CaptureHint,
): string | undefined {
	return getClient()?.captureMessage(message, levelOrHint);
}

export function addBreadcrumb(crumb: Breadcrumb): void {
	getClient()?.addBreadcrumb(crumb);
}

export function setUser(user: User | null): void {
	getClient()?.setUser(user);
}

export function setTag(key: string, value: string): void {
	getClient()?.setTag(key, value);
}

export function setTags(tags: Record<string, string>): void {
	getClient()?.setTags(tags);
}

export function setContext(
	name: string,
	context: Record<string, unknown> | null,
): void {
	getClient()?.setContext(name, context);
}

export function setExtra(key: string, value: unknown): void {
	getClient()?.setExtra(key, value);
}

/** Empieza una transacción manual; con el SDK sin iniciar, devuelve `undefined`. */
export function startTransaction(
	context: StartTransactionContext,
): Transaction | undefined {
	return getClient()?.startTransaction(context);
}

/**
 * Ejecuta `fn` con una transacción nueva como la "en curso" solo dentro de ella: así se pueden medir
 * varias operaciones a la vez en un servidor. Termina la transacción con `transaction.finish()`.
 */
export function runTransaction<T>(
	context: StartTransactionContext,
	fn: (transaction: Transaction) => T,
): T | undefined {
	return getClient()?.runTransaction(context, fn);
}

export function startSpan(
	op: string,
	description?: string,
	data?: Record<string, unknown>,
	startTimestamp?: number,
): Span | undefined {
	return getClient()?.startSpan(op, description, data, startTimestamp);
}

/** Mide una función (síncrona o async). Con el SDK sin iniciar, simplemente la ejecuta. */
export function trace<T>(
	op: string,
	description: string | undefined,
	fn: (span: Span) => T,
): T {
	const current = getClient();
	return current ? current.trace(op, description, fn) : fn(NOOP_SPAN);
}

const NOOP_SPAN = {
	op: "noop",
	setData() {
		return this;
	},
	setStatus() {
		return this;
	},
	end() {},
} as unknown as Span;

/** La transacción en curso (la de la petición que se está atendiendo), por si quieres renombrarla o etiquetarla. */
export function getActiveTransaction(): Transaction | undefined {
	return getClient()?.activeTransaction();
}

export async function flush(timeoutMs?: number): Promise<boolean> {
	const current = getClient();
	return current ? current.flush(timeoutMs) : true;
}

export async function close(timeoutMs?: number): Promise<boolean> {
	const current = getClient();
	setClient(undefined);
	return current ? current.close(timeoutMs) : true;
}
