import * as Sentinel from "@sentinel/browser";
import { ingestEventSchema } from "@sentinel/shared";
import { afterEach, beforeEach, vi } from "vitest";

const KEY = "0123456789abcdef0123456789abcdef";
const PROJECT = "48140d16-1ad4-4a8b-b08e-04762f0d78b9";
export const DSN = `https://${KEY}@api.example.com/${PROJECT}`;

/** Eventos que el SDK real envió (con `fetch` simulado), ya validados contra el esquema del servidor. */
export function useSentinel(options: Partial<Sentinel.SentinelOptions> = {}) {
	const sent: Array<ReturnType<typeof ingestEventSchema.parse>> = [];

	beforeEach(() => {
		sent.length = 0;
		vi.stubGlobal(
			"fetch",
			vi.fn(async (_url: string, init: { body: string }) => {
				sent.push(ingestEventSchema.parse(JSON.parse(init.body)));
				return new Response(null, { status: 202 });
			}),
		);
		Sentinel.init({ dsn: DSN, breadcrumbs: false, ...options });
	});
	afterEach(async () => {
		await Sentinel.close();
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	return {
		sent,
		/** Espera los envíos pendientes y devuelve lo enviado. */
		async events() {
			await Sentinel.flush();
			return sent;
		},
	};
}

/** Error con un mensaje único: el SDK descarta repetidos idénticos en menos de un segundo. */
let counter = 0;
export const uniqueError = (label = "boom") =>
	new Error(`${label} #${++counter}`);
