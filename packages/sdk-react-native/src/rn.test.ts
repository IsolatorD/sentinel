import { ingestEventSchema, ingestTransactionSchema } from "@sentinel/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RNClient } from "./client";
import { setClient } from "./hub";
import type { ReactNativeModule } from "./native";
import { instrumentNavigation } from "./navigation";
import type { RNOptions } from "./types";

const KEY = "0123456789abcdef0123456789abcdef";
const PROJECT = "48140d16-1ad4-4a8b-b08e-04762f0d78b9";
const DSN = `https://${KEY}@sentinel.example.com/${PROJECT}`;
type Body = Record<string, unknown>;

type Handler = (error: unknown, isFatal?: boolean) => void;
class FakeErrorUtils {
	handler: Handler = () => {};
	getGlobalHandler = () => this.handler;
	setGlobalHandler = (h: Handler) => {
		this.handler = h;
	};
}

const appStateListeners: Array<(s: string) => void> = [];
const reactNative: ReactNativeModule = {
	Platform: { OS: "ios", Version: "17.5" },
	AppState: {
		currentState: "active",
		addEventListener: (_t, listener) => {
			appStateListeners.push(listener);
			return {
				remove: () =>
					appStateListeners.splice(appStateListeners.indexOf(listener), 1),
			};
		},
	},
};

const clients: RNClient[] = [];
let utils: FakeErrorUtils;
let previousHandler: ReturnType<typeof vi.fn>;

beforeEach(() => {
	utils = new FakeErrorUtils();
	previousHandler = vi.fn();
	utils.handler = previousHandler as unknown as Handler;
	(globalThis as Record<string, unknown>).ErrorUtils = utils;
});
afterEach(async () => {
	await Promise.all(clients.splice(0).map((c) => c.close()));
	setClient(undefined);
	delete (globalThis as Record<string, unknown>).ErrorUtils;
	delete (globalThis as Record<string, unknown>).HermesInternal;
	vi.restoreAllMocks();
});

function boot(options: Partial<RNOptions> = {}) {
	const bodies: Body[] = [];
	const fetchImpl = vi.fn(async (_url: string, init: { body: string }) => {
		bodies.push(JSON.parse(init.body));
		return new Response(null, { status: 202 });
	});
	const client = new RNClient(
		{ dsn: DSN, breadcrumbs: false, ...options },
		{
			fetchImpl: fetchImpl as unknown as typeof fetch,
			retryDelays: [1],
			reactNative,
		},
	).install();
	setClient(client);
	clients.push(client);
	return {
		client,
		events: () => bodies.filter((b) => !("trace_id" in b)),
		transactions: () => bodies.filter((b) => "trace_id" in b),
	};
}

describe("eventos", () => {
	it("un evento es válido para el servidor y trae plataforma, SO y motor de JavaScript", async () => {
		const { client, events } = boot({ release: "1.0.0", environment: "prod" });
		client.captureException(new TypeError("undefined is not an object"));
		await client.flush();
		const [event] = events();
		const parsed = ingestEventSchema.safeParse(event);
		expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
		expect(event).toMatchObject({
			platform: "react-native",
			release: "1.0.0",
			contexts: {
				sdk: { name: "sentinel.javascript.react-native" },
				os: { name: "iOS", version: "17.5" },
				runtime: { name: "JavaScriptCore" },
				app: { state: "active" },
			},
		});
	});

	it("los frames del bundle se envían como app:///<archivo> para que el servidor los simbolice", async () => {
		const { client, events } = boot();
		const error = new Error("boom");
		error.stack = [
			"Error: boom",
			"    at onPress (address at /data/user/0/com.shop/files/index.android.bundle:1:2345)",
			"    at anonymous (address at index.android.bundle:1:99)",
			"    at apply (native)",
		].join("\n");
		client.captureException(error);
		await client.flush();

		const frames = (
			events()[0].exception as {
				values: Array<{
					stacktrace: { frames: Array<Record<string, unknown>> };
				}>;
			}
		).values[0].stacktrace.frames;
		expect(frames.map((f) => f.filename)).toEqual([
			"native",
			"app:///index.android.bundle",
			"app:///index.android.bundle",
		]);
		expect(frames[2]).toMatchObject({
			function: "onPress",
			lineno: 1,
			colno: 2345,
			abs_path: "/data/user/0/com.shop/files/index.android.bundle",
		});
		expect(frames[0].in_app).toBe(false);
	});

	it("Hermes se reconoce como motor", async () => {
		(globalThis as Record<string, unknown>).HermesInternal = {};
		const { client, events } = boot();
		client.captureMessage("hi");
		await client.flush();
		expect(
			(events()[0].contexts as Record<string, { name: string }>).runtime.name,
		).toBe("Hermes");
	});
});

describe("errores globales", () => {
	it("un error no fatal se captura y se deja pasar al manejador anterior", async () => {
		const { events, client } = boot();
		const error = new Error("non fatal");
		utils.handler(error, false);
		expect(previousHandler).toHaveBeenCalledWith(error, false);
		await client.flush();
		expect(events()[0]).toMatchObject({
			level: "error",
			tags: { handled: "false", mechanism: "onerror", fatal: "false" },
		});
	});

	it("un error fatal se envía ANTES de dejar que la app se cierre", async () => {
		const order: string[] = [];
		previousHandler.mockImplementation(() => order.push("previous"));
		const bodies: Body[] = [];
		const fetchImpl = vi.fn(async (_u: string, init: { body: string }) => {
			await new Promise((r) => setTimeout(r, 30));
			bodies.push(JSON.parse(init.body));
			order.push("sent");
			return new Response(null, { status: 202 });
		});
		const client = new RNClient(
			{ dsn: DSN, breadcrumbs: false },
			{ fetchImpl: fetchImpl as unknown as typeof fetch, reactNative },
		).install();
		clients.push(client);
		setClient(client);

		utils.handler(new Error("crash"), true);
		expect(order).toEqual([]); // aún no: se espera al envío
		await vi.waitFor(() => expect(order).toEqual(["sent", "previous"]));
		expect(bodies[0]).toMatchObject({
			level: "fatal",
			tags: { fatal: "true" },
		});
	});

	it("un envío que no termina no retiene el cierre más del plazo", async () => {
		const fetchImpl = vi.fn(() => new Promise<Response>(() => {}));
		const client = new RNClient(
			{ dsn: DSN, breadcrumbs: false, fatalFlushTimeoutMs: 40 },
			{ fetchImpl: fetchImpl as unknown as typeof fetch, reactNative },
		).install();
		clients.push(client);
		utils.handler(new Error("crash"), true);
		await vi.waitFor(() => expect(previousHandler).toHaveBeenCalled(), {
			timeout: 1000,
		});
	});

	it("al cerrar el cliente se restaura el manejador original", async () => {
		const { client } = boot();
		expect(utils.handler).not.toBe(previousHandler);
		await client.close();
		expect(utils.handler).toBe(previousHandler);
	});

	it("las promesas rechazadas se capturan con el rastreador de Hermes", async () => {
		let onUnhandled: ((id: number, reason: unknown) => void) | undefined;
		(globalThis as Record<string, unknown>).HermesInternal = {
			enablePromiseRejectionTracker: (o: {
				onUnhandled: typeof onUnhandled;
			}) => {
				onUnhandled = o.onUnhandled;
			},
		};
		const { client, events } = boot();
		onUnhandled?.(1, new RangeError("rejected"));
		onUnhandled?.(2, "a plain string");
		await client.flush();
		expect(
			events().map((e) =>
				(
					e.exception as { values: Array<{ type: string; value: string }> }
				).values.at(-1),
			),
		).toEqual([
			expect.objectContaining({ type: "RangeError", value: "rejected" }),
			expect.objectContaining({
				type: "UnhandledRejection",
				value:
					"Non-Error promise rejection captured with value: a plain string",
			}),
		]);
		await client.close();
		onUnhandled?.(3, new Error("after close"));
		expect(events()).toHaveLength(2);
	});

	it("con captureGlobalErrors en false no toca el manejador", () => {
		boot({ captureGlobalErrors: false });
		expect(utils.handler).toBe(previousHandler);
	});
});

describe("ciclo de vida", () => {
	it("al pasar a segundo plano se envía lo pendiente y queda un breadcrumb", async () => {
		const { client, events } = boot({
			breadcrumbs: { appState: true, console: false, http: false },
		});
		client.captureMessage("pending");
		appStateListeners.forEach((l) => {
			l("background");
		});
		client.captureMessage("after");
		await client.flush();
		const crumbs =
			(events()[1].breadcrumbs as Array<{
				category: string;
				message: string;
			}>) ?? [];
		expect(crumbs.map((c) => [c.category, c.message])).toEqual([
			["app.lifecycle", "background"],
		]);
	});
});

describe("rendimiento", () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	it("el arranque de la app termina con la primera pantalla", async () => {
		const { client, transactions } = boot({ tracesSampleRate: 1 });
		await vi.advanceTimersByTimeAsync(5_000);
		expect(transactions()).toHaveLength(0); // retenida hasta la primera pantalla
		client.appReady();
		await vi.advanceTimersByTimeAsync(1_500);
		await client.flush();
		const [tx] = transactions();
		expect(ingestTransactionSchema.safeParse(tx).success).toBe(true);
		expect(tx).toMatchObject({
			name: "app.start",
			op: "app.start",
			platform: "react-native",
		});
	});

	it("si nadie la libera, el arranque termina por el límite de 15 s", async () => {
		const { client, transactions } = boot({ tracesSampleRate: 1 });
		await vi.advanceTimersByTimeAsync(16_000);
		await client.flush();
		expect(transactions()[0]).toMatchObject({
			name: "app.start",
			status: "deadline_exceeded",
		});
	});

	it("instrumentNavigation: una transacción por pantalla, un breadcrumb por cambio y libera el arranque", async () => {
		const { client, transactions, events } = boot({
			tracesSampleRate: 1,
			breadcrumbs: {
				navigation: true,
				console: false,
				http: false,
				appState: false,
			},
		});
		let route = { name: "Home" };
		const listeners: Array<() => void> = [];
		const container = {
			addListener: (_e: "state", l: () => void) => {
				listeners.push(l);
				return () => listeners.splice(listeners.indexOf(l), 1);
			},
			getCurrentRoute: () => route,
		};
		const stop = instrumentNavigation(container);

		await vi.advanceTimersByTimeAsync(500);
		route = { name: "Cart" };
		listeners.forEach((l) => {
			l();
		});
		listeners.forEach((l) => {
			l();
		}); // el mismo destino otra vez: no cuenta
		await vi.advanceTimersByTimeAsync(2_000);
		client.captureMessage("x");
		await client.flush();

		expect(
			transactions()
				.map((t) => [t.name, t.op])
				.sort(),
		).toEqual([
			["Cart", "navigation"],
			["Home", "navigation"],
			["app.start", "app.start"],
		]);
		const crumbs = events()[0].breadcrumbs as Array<{
			data: { from: string | null; to: string };
		}>;
		expect(crumbs.map((c) => [c.data.from, c.data.to])).toEqual([
			[null, "Home"],
			["Home", "Cart"],
		]);
		stop();
		expect(listeners).toHaveLength(0);
	});

	it("sin tracesSampleRate no se mide nada", async () => {
		const { client, transactions } = boot();
		client.appReady();
		await vi.advanceTimersByTimeAsync(2_000);
		await client.flush();
		expect(transactions()).toHaveLength(0);
	});
});
