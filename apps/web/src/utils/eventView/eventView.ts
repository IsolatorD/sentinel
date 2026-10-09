import { type IngestEvent, ingestEventSchema } from "@sentinel/shared";
import type { EventView } from "@/utils/eventView/eventViewInterface";

/** Interpreta el payload de un evento. Devuelve null si no cumple el formato esperado. */
export function parseEventPayload(
	payload: Record<string, unknown>,
): EventView | null {
	const result = ingestEventSchema.safeParse(payload);
	if (!result.success) return null;
	const client = payload._client;
	return {
		...result.data,
		...(client && typeof client === "object"
			? { _client: client as EventView["_client"] }
			: {}),
	};
}

/** Contextos en forma de lista clave-valor legible (browser, os, viewport...). */
export function contextEntries(
	contexts: IngestEvent["contexts"],
	name: string,
): Array<[string, string]> {
	const ctx = contexts?.[name];
	if (!ctx) return [];
	return Object.entries(ctx).map(([k, v]) => [
		k,
		typeof v === "object" ? JSON.stringify(v) : String(v),
	]);
}
