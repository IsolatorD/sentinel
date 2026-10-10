import { SentinelClient } from "./client";
import { Span } from "./tracing/span";
import type { StartTransactionContext } from "./tracing/tracer";
import type { Transaction } from "./tracing/transaction";
import type {
	Breadcrumb,
	CaptureHint,
	Level,
	SentinelOptions,
	User,
} from "./types";

export { SentinelClient } from "./client";
export type { Span } from "./tracing/span";
export type { StartTransactionContext } from "./tracing/tracer";
export type { Measurement, Transaction } from "./tracing/transaction";
export type {
	Breadcrumb,
	BreadcrumbOptions,
	CaptureHint,
	ExceptionValue,
	Level,
	SentinelEvent,
	SentinelOptions,
	SentinelSpan,
	SentinelTransaction,
	StackFrame,
	TracingOptions,
	User,
} from "./types";
export { SDK_VERSION } from "./version";

let client: SentinelClient | undefined;

/**
 * Inicializa el SDK. Llamar una sola vez, lo antes posible en la app.
 * Si la DSN es inválida, el SDK queda desactivado y no lanza.
 */
export function init(options: SentinelOptions): SentinelClient {
	if (client) void client.close();
	client = new SentinelClient(options).install();
	return client;
}

export function getClient(): SentinelClient | undefined {
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

/** Empieza una transacción manual. Con el SDK sin iniciar, devuelve `undefined`. */
export function startTransaction(
	context: StartTransactionContext,
): Transaction | undefined {
	return client?.startTransaction(context);
}

/** Span dentro de la transacción en curso. Con el SDK sin iniciar, devuelve `undefined`. */
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
	return client
		? client.trace(op, description, fn)
		: fn(new Span("noop", undefined, "", 0, () => 0));
}

export async function flush(timeoutMs?: number): Promise<boolean> {
	return client ? client.flush(timeoutMs) : true;
}

export async function close(timeoutMs?: number): Promise<boolean> {
	const current = client;
	client = undefined;
	return current ? current.close(timeoutMs) : true;
}
