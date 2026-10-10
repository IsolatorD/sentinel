import type {
	Span,
	StartTransactionContext,
	Transaction,
} from "@sentinel/core";
import { RNClient, type RNClientDeps } from "./client";
import { getClient, setClient } from "./hub";
import type { Breadcrumb, CaptureHint, Level, RNOptions, User } from "./types";

export type {
	Measurement,
	Span,
	StartTransactionContext,
	Transaction,
} from "@sentinel/core";
export { RNClient as SentinelClient } from "./client";
export {
	ErrorBoundary,
	type ErrorBoundaryProps,
	type FallbackProps,
	withErrorBoundary,
} from "./error-boundary";
export {
	instrumentNavigation,
	type NavigationContainerLike,
} from "./navigation";
export { Profiler, type ProfilerProps, withProfiler } from "./profiler";
export type {
	Breadcrumb,
	CaptureHint,
	ExceptionValue,
	Level,
	RNBreadcrumbOptions,
	RNOptions,
	RNTracingOptions,
	SentinelEvent,
	SentinelSpan,
	SentinelTransaction,
	StackFrame,
	User,
} from "./types";
export { SDK_VERSION } from "./version";
export { getClient };

/**
 * Inicializa el SDK. Llamar una sola vez, lo antes posible (en la primera línea de `index.js`, antes
 * de registrar la app). Con una DSN inválida el SDK queda desactivado y no lanza.
 */
export function init(options: RNOptions, deps?: RNClientDeps): RNClient {
	const previous = getClient();
	if (previous) void previous.close();
	const created = new RNClient(options, deps).install();
	setClient(created);
	return created;
}

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

export function startSpan(
	op: string,
	description?: string,
	data?: Record<string, unknown>,
	startTimestamp?: number,
): Span | undefined {
	return getClient()?.startSpan(op, description, data, startTimestamp);
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

/** Mide una función (síncrona o async). Con el SDK sin iniciar, simplemente la ejecuta. */
export function trace<T>(
	op: string,
	description: string | undefined,
	fn: (span: Span) => T,
): T {
	const current = getClient();
	return current ? current.trace(op, description, fn) : fn(NOOP_SPAN);
}

/** La app ya muestra su primera pantalla (si no usas `instrumentNavigation`): termina `app.start`. */
export function appReady(): void {
	getClient()?.appReady();
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
