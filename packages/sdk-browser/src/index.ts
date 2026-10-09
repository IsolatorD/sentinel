import { SentinelClient } from "./client";
import type {
	Breadcrumb,
	CaptureHint,
	Level,
	SentinelOptions,
	User,
} from "./types";

export { SentinelClient } from "./client";
export type {
	Breadcrumb,
	BreadcrumbOptions,
	CaptureHint,
	ExceptionValue,
	Level,
	SentinelEvent,
	SentinelOptions,
	StackFrame,
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

export async function flush(timeoutMs?: number): Promise<boolean> {
	return client ? client.flush(timeoutMs) : true;
}

export async function close(timeoutMs?: number): Promise<boolean> {
	const current = client;
	client = undefined;
	return current ? current.close(timeoutMs) : true;
}
