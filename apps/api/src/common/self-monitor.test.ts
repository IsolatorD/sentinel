import { beforeEach, describe, expect, it, vi } from "vitest";

const sdk = vi.hoisted(() => ({
	init: vi.fn(),
	captureException: vi.fn(),
	close: vi.fn(async () => true),
}));
vi.mock("@argus-isolator/node", () => sdk);

const load = async () => {
	vi.resetModules();
	return import("./self-monitor.js");
};

beforeEach(() => vi.clearAllMocks());

describe("self-monitor", () => {
	it("sin DSN no inicializa nada y no reporta", async () => {
		const m = await load();
		expect(m.startSelfMonitor({ environment: "production" })).toBe(false);
		m.reportUnexpected(new Error("boom"));
		await m.stopSelfMonitor();
		expect(sdk.init).not.toHaveBeenCalled();
		expect(sdk.captureException).not.toHaveBeenCalled();
		expect(sdk.close).not.toHaveBeenCalled();
	});

	it("con DSN inicializa la SDK solo para errores (sin trazas) y reporta los inesperados", async () => {
		const m = await load();
		expect(
			m.startSelfMonitor({
				dsn: "https://k@sentinel.example/p",
				environment: "production",
			}),
		).toBe(true);
		const options = sdk.init.mock.calls[0][0];
		expect(options).toMatchObject({
			dsn: "https://k@sentinel.example/p",
			environment: "production",
		});
		expect(options).not.toHaveProperty("tracesSampleRate");

		const error = new Error("boom");
		m.reportUnexpected(error);
		expect(sdk.captureException).toHaveBeenCalledWith(error);

		await m.stopSelfMonitor();
		expect(sdk.close).toHaveBeenCalled();
	});
});
