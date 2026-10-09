import { vi } from "vitest";
import { SentinelClient } from "./client";
import type { SentinelEvent, SentinelOptions } from "./types";

export const KEY = "0123456789abcdef0123456789abcdef";
export const PROJECT = "48140d16-1ad4-4a8b-b08e-04762f0d78b9";
export const DSN = `https://${KEY}@api.example.com/${PROJECT}`;
export const ENDPOINT = `https://api.example.com/api/${PROJECT}/events`;

/** Cliente con un fetch simulado que acumula los eventos enviados. */
export function createTestClient(
	options: Partial<SentinelOptions> = {},
	status = 202,
) {
	const sent: SentinelEvent[] = [];
	const fetchImpl = vi.fn(async (_url: string, init: { body: string }) => {
		sent.push(JSON.parse(init.body));
		return new Response(null, { status });
	});
	const client = new SentinelClient(
		{ dsn: DSN, ...options },
		{ fetchImpl: fetchImpl as unknown as typeof fetch, retryDelays: [1] },
	);
	return { client, sent, fetchImpl };
}
