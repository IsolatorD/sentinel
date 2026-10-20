import type { ConfigService } from "@nestjs/config";
import { describe, expect, it } from "vitest";
import { PublicConfigController } from "./public-config.controller.js";

const controller = (values: Record<string, unknown>) =>
	new PublicConfigController({
		get: (key: string) => values[key],
	} as unknown as ConfigService<never, true>);

describe("PublicConfigController: DSN de la propia instancia", () => {
	it("sin configurar, la web no reporta nada", () => {
		expect(controller({}).get().monitoringDsn).toBeNull();
	});

	it("la web usa su DSN propia si la hay", () => {
		const dsn = controller({
			SELF_MONITOR_DSN: "https://k@h/backend",
			SELF_MONITOR_WEB_DSN: "https://k@h/web",
		}).get().monitoringDsn;
		expect(dsn).toBe("https://k@h/web");
	});

	it("sin DSN propia para la web, usa la del servidor", () => {
		expect(
			controller({ SELF_MONITOR_DSN: "https://k@h/backend" }).get()
				.monitoringDsn,
		).toBe("https://k@h/backend");
	});
});
