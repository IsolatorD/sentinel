import { describe, expect, it } from "vitest";
import { newProjectDefaults } from "./new-project-defaults.js";

describe("newProjectDefaults", () => {
	it("sin configuración no impone nada (manda la base de datos)", () => {
		expect(newProjectDefaults({})).toEqual({});
	});

	it("incluye solo lo configurado", () => {
		expect(newProjectDefaults({ monthlyEventQuota: 5_000 })).toEqual({
			monthlyEventQuota: 5_000,
		});
		expect(
			newProjectDefaults({
				retentionDays: 30,
				monthlyEventQuota: 5_000,
				monthlyTransactionQuota: 2_000,
			}),
		).toEqual({
			retentionDays: 30,
			monthlyEventQuota: 5_000,
			monthlyTransactionQuota: 2_000,
		});
	});
});
