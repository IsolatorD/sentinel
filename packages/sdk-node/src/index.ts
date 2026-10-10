import {
	type Span,
	type StartTransactionContext,
	type Transaction,
} from "@sentinel/core";
import { NodeClient } from "./client";
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

let client: NodeClient | undefined;

/**
 * Inicializa el SDK. Llamar una sola vez, lo antes posible (antes de crear el servidor).
 * Si la DSN es inválida, el SDK queda desactivado y no lanza.
 */
export function init(options: NodeOptions): NodeClient {
	if (client) void client.close();
	client = new NodeClient(options).install();
	return client;
}

export function getClient(): NodeClient | undefined {
	return client;
}

export function captureException(
	thrown: unknown,
	hint?: CaptureHint,
): string | undefined {
	return client?.captureException(thrown, hint);
}

export function captureMessage(
	message: string,
	levelOrHint?: Level | CaptureHint,
): string | undefined {
	return client?.captureMessage(message, levelOrHint);
}

export function addBreadcrumb(crumb: Breadcrumb): void {
	client?.addBreadcrumb(crumb);
}

export function setUser(user: User | null): void {
	client?.setUser(user);
}

export function setTag(key: string, value: string): void {
	client?.setTag(key, value);
}

export function setTags(tags: Record<string, string>): void {
	client?.setTags(tags);
}

export function setContext(
	name: string,
	context: Record<string, unknown> | null,
): void {
	client?.setContext(name, context);
}

export function setExtra(key: string, value: unknown): void {
	client?.setExtra(key, value);
}

/** Empieza una transacción manual; con el SDK sin iniciar, devuelve `undefined`. */
export function startTransaction(
	context: StartTransactionContext,
): Transaction | undefined {
	return client?.startTransaction(context);
}

/**
 * Ejecuta `fn` con una transacción nueva como la "en curso" solo dentro de ella: así se pueden medir
 * varias operaciones a la vez en un servidor. Termina la transacción con `transaction.finish()`.
 */
export function runTransaction<T>(
	context: StartTransactionContext,
	fn: (transaction: Transaction) => T,
): T | undefined {
	return client?.runTransaction(context, fn);
}

export function startSpan(
	op: string,
	description?: string,
	data?: Record<string, unknown>,
	startTimestamp?: number,
): Span | undefined {
	return client?.startSpan(op, description, data, startTimestamp);
}

/** Mide una función (síncrona o async). Con el SDK sin iniciar, simplemente la ejecuta. */
export function trace<T>(
	op: string,
	description: string | undefined,
	fn: (span: Span) => T,
): T {
	return client ? client.trace(op, description, fn) : fn(NOOP_SPAN);
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

export async function flush(timeoutMs?: number): Promise<boolean> {
	return client ? client.flush(timeoutMs) : true;
}

export async function close(timeoutMs?: number): Promise<boolean> {
	const current = client;
	client = undefined;
	return current ? current.close(timeoutMs) : true;
}
