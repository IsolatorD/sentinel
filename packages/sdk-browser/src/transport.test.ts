import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Transport } from "./transport";
import type { SentinelEvent } from "./types";

const endpoint = "https://api.example.com/api/p/events";
const key = "0123456789abcdef0123456789abcdef";
const event: SentinelEvent = { level: "error", message: "boom" };

const response = (status: number, headers: Record<string, string> = {}) =>
	new Response(null, { status, headers });

function setup(fetchImpl: ReturnType<typeof vi.fn>, extra = {}) {
	return new Transport({
		endpoint,
		publicKey: key,
		fetchImpl: fetchImpl as unknown as typeof fetch,
		retryDelays: [10, 20, 30],
		...extra,
	});
}

describe("Transport", () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	it("envía un POST JSON con la clave, sin credenciales y con keepalive", async () => {
		const fetchImpl = vi.fn().mockResolvedValue(response(202));
		await expect(setup(fetchImpl).send(event)).resolves.toBe(true);

		expect(fetchImpl).toHaveBeenCalledTimes(1);
		const [url, init] = fetchImpl.mock.calls[0];
		expect(url).toBe(endpoint);
		expect(init).toMatchObject({
			method: "POST",
			headers: { "Content-Type": "application/json", "X-Sentinel-Key": key },
			credentials: "omit",
			mode: "cors",
			keepalive: true,
		});
		expect(JSON.parse(init.body)).toEqual(event);
	});

	it("no usa keepalive si el cuerpo supera el límite de 64 KB", async () => {
		const fetchImpl = vi.fn().mockResolvedValue(response(202));
		await setup(fetchImpl).send({ ...event, message: "x".repeat(70_000) });
		expect(fetchImpl.mock.calls[0][1].keepalive).toBe(false);
	});

	it("descarta sin reintentar ante un 4xx", async () => {
		const fetchImpl = vi.fn().mockResolvedValue(response(401));
		await expect(setup(fetchImpl).send(event)).resolves.toBe(false);
		expect(fetchImpl).toHaveBeenCalledTimes(1);
	});

	it("reintenta ante un 5xx y entrega cuando el servidor se recupera", async () => {
		const fetchImpl = vi
			.fn()
			.mockResolvedValueOnce(response(503))
			.mockResolvedValueOnce(response(500))
			.mockResolvedValueOnce(response(202));
		const promise = setup(fetchImpl).send(event);
		await vi.runAllTimersAsync();
		await expect(promise).resolves.toBe(true);
		expect(fetchImpl).toHaveBeenCalledTimes(3);
	});

	it("reintenta ante errores de red y se rinde tras el máximo de reintentos", async () => {
		const fetchImpl = vi
			.fn()
			.mockRejectedValue(new TypeError("Failed to fetch"));
		const promise = setup(fetchImpl).send(event);
		await vi.runAllTimersAsync();
		await expect(promise).resolves.toBe(false);
		expect(fetchImpl).toHaveBeenCalledTimes(4); // intento inicial + 3 reintentos
	});

	it("ante un 429 pausa el envío según Retry-After y descarta mientras tanto", async () => {
		const fetchImpl = vi
			.fn()
			.mockResolvedValue(response(429, { "Retry-After": "30" }));
		const transport = setup(fetchImpl);

		await expect(transport.send(event)).resolves.toBe(false);
		expect(fetchImpl).toHaveBeenCalledTimes(1);

		// Pausado: ni siquiera intenta la red.
		await expect(transport.send(event)).resolves.toBe(false);
		expect(fetchImpl).toHaveBeenCalledTimes(1);

		// Pasado el tiempo indicado, vuelve a enviar.
		vi.advanceTimersByTime(31_000);
		fetchImpl.mockResolvedValue(response(202));
		await expect(transport.send(event)).resolves.toBe(true);
		expect(fetchImpl).toHaveBeenCalledTimes(2);
	});

	it("nunca rechaza la promesa, ni siquiera si fetch lanza síncronamente", async () => {
		const fetchImpl = vi.fn().mockImplementation(() => {
			throw new Error("sync boom");
		});
		const promise = setup(fetchImpl, { maxRetries: 0 }).send(event);
		await vi.runAllTimersAsync();
		await expect(promise).resolves.toBe(false);
	});

	it("flush espera a los envíos pendientes y respeta el tiempo máximo", async () => {
		let release!: (r: Response) => void;
		const fetchImpl = vi
			.fn()
			.mockReturnValue(new Promise<Response>((r) => (release = r)));
		const transport = setup(fetchImpl);
		void transport.send(event);

		const flushed = transport.flush(5_000);
		release(response(202));
		await expect(flushed).resolves.toBe(true);

		const stuck = vi.fn().mockReturnValue(new Promise<Response>(() => {}));
		const t2 = setup(stuck);
		void t2.send(event);
		const timedOut = t2.flush(100);
		await vi.advanceTimersByTimeAsync(150);
		await expect(timedOut).resolves.toBe(false);
	});

	it("al cerrar la página manda con sendBeacon lo que esperaba un reintento", async () => {
		const beacon = vi.fn().mockReturnValue(true);
		vi.stubGlobal("navigator", { sendBeacon: beacon });
		const fetchImpl = vi.fn().mockRejectedValue(new TypeError("offline"));
		const transport = setup(fetchImpl);

		const promise = transport.send(event);
		await vi.advanceTimersByTimeAsync(0); // primer intento falla; queda esperando
		transport.flushWithBeacon();

		expect(beacon).toHaveBeenCalledTimes(1);
		expect(beacon.mock.calls[0][0]).toBe(`${endpoint}?sentinel_key=${key}`);
		expect(beacon.mock.calls[0][1]).toBeInstanceOf(Blob);

		await vi.runAllTimersAsync();
		await expect(promise).resolves.toBe(false); // ya se mandó por beacon: no se reintenta
		expect(fetchImpl).toHaveBeenCalledTimes(1);
		vi.unstubAllGlobals();
	});
});
