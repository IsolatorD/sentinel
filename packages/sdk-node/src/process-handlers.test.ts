import { afterEach, describe, expect, it, vi } from "vitest";
import { installProcessHandlers } from "./instrumentation/process-handlers";

type Listener = (...args: unknown[]) => void;

/** Instala los handlers y devuelve los que se añadieron, para invocarlos directamente. */
function install(
	options: Partial<Parameters<typeof installProcessHandlers>[0]> = {},
) {
	const before = {
		uncaught: new Set(process.listeners("uncaughtException") as Listener[]),
		rejection: new Set(process.listeners("unhandledRejection") as Listener[]),
	};
	const captureThrown = vi.fn(() => "id");
	const flush = vi.fn(async () => true);
	const uninstall = installProcessHandlers({
		captureThrown,
		flush,
		exitOnUncaughtException: false,
		unhandledRejection: "warn",
		shutdownTimeoutMs: 10,
		...options,
	});
	const added = (
		event: "uncaughtException" | "unhandledRejection",
		known: Set<Listener>,
	) =>
		(process.listeners(event) as Listener[]).find(
			(l) => !known.has(l),
		) as Listener;
	return {
		captureThrown,
		flush,
		uninstall,
		onUncaught: added("uncaughtException", before.uncaught),
		onRejection: added("unhandledRejection", before.rejection),
	};
}

afterEach(() => vi.restoreAllMocks());

describe("handlers del proceso", () => {
	it("una excepción no controlada se captura como fatal y no manejada", () => {
		const h = install();
		const error = new Error("se cayó");
		h.onUncaught(error);
		expect(h.captureThrown).toHaveBeenCalledWith(error, {
			level: "fatal",
			tags: { handled: "false", mechanism: "uncaughtException" },
		});
		h.uninstall();
	});

	it("con exitOnUncaughtException envía lo pendiente y termina con código 1", async () => {
		const exit = vi
			.spyOn(process, "exit")
			.mockImplementation((() => undefined) as never);
		vi.spyOn(console, "error").mockImplementation(() => {});
		// El runner de tests tiene sus propios handlers: se apartan para simular una app sin ellos.
		const others = process.listeners("uncaughtException");
		process.removeAllListeners("uncaughtException");
		const h = install({ exitOnUncaughtException: true });
		try {
			h.onUncaught(new Error("fatal"));
			await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(1));
			expect(h.flush).toHaveBeenCalledWith(10);
		} finally {
			h.uninstall();
			for (const l of others) process.on("uncaughtException", l);
		}
	});

	it("si la app tiene su propio handler, no termina el proceso", async () => {
		const exit = vi
			.spyOn(process, "exit")
			.mockImplementation((() => undefined) as never);
		const h = install({ exitOnUncaughtException: true });
		// Ya hay otros listeners (los del runner): se respeta que decidan ellos.
		h.onUncaught(new Error("x"));
		await new Promise((r) => setTimeout(r, 20));
		expect(exit).not.toHaveBeenCalled();
		h.uninstall();
	});

	it("una promesa rechazada se captura y, por defecto, solo avisa en la consola", () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const h = install();
		h.onRejection(new RangeError("rechazada"));
		expect(h.captureThrown.mock.calls[0]).toMatchObject([
			expect.any(RangeError),
			{ tags: { handled: "false", mechanism: "unhandledRejection" } },
			{ nonErrorType: "UnhandledRejection" },
		]);
		expect(warn).toHaveBeenCalled();
		h.uninstall();
	});

	it("en modo strict la relanza; con none no hace más que capturar", () => {
		const strict = install({ unhandledRejection: "strict" });
		const reason = new Error("strict");
		expect(() => strict.onRejection(reason)).toThrow(reason);
		strict.uninstall();

		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const none = install({ unhandledRejection: "none" });
		expect(() => none.onRejection(new Error("x"))).not.toThrow();
		expect(warn).not.toHaveBeenCalled();
		none.uninstall();
	});

	it("uninstall quita los listeners", () => {
		const before = process.listenerCount("uncaughtException");
		const h = install();
		expect(process.listenerCount("uncaughtException")).toBe(before + 1);
		h.uninstall();
		expect(process.listenerCount("uncaughtException")).toBe(before);
	});
});
