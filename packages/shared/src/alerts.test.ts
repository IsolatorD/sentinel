import { describe, expect, it } from "vitest";
import {
	createRuleSchema,
	ruleShapeProblem,
	updateRuleSchema,
} from "./alerts.js";

const channelIds = ["6b0f4d5e-1a2b-4c3d-8e9f-0a1b2c3d4e5f"];
const base = { name: "Regla", channelIds };

describe("ruleShapeProblem", () => {
	it("las reglas de issue no llevan umbral, ventana ni transacción", () => {
		expect(ruleShapeProblem({ trigger: "new_issue" })).toBeNull();
		expect(ruleShapeProblem({ trigger: "regression", threshold: 5 })).toEqual({
			path: "threshold",
			code: "THRESHOLD_NOT_ALLOWED",
		});
		expect(
			ruleShapeProblem({ trigger: "new_issue", transactionName: "/x" }),
		).toEqual({ path: "transactionName", code: "PERFORMANCE_ONLY_FIELD" });
	});

	it("frecuencia exige umbral y ventana", () => {
		expect(ruleShapeProblem({ trigger: "frequency" })?.path).toBe("threshold");
		expect(ruleShapeProblem({ trigger: "frequency", threshold: 5 })?.path).toBe(
			"windowMinutes",
		);
		expect(
			ruleShapeProblem({
				trigger: "frequency",
				threshold: 5,
				windowMinutes: 10,
			}),
		).toBeNull();
	});

	it("rendimiento exige umbral y una ventana de al menos 5 minutos", () => {
		expect(ruleShapeProblem({ trigger: "p95_above" })?.code).toBe(
			"PERFORMANCE_FIELD_REQUIRED",
		);
		expect(
			ruleShapeProblem({
				trigger: "p95_above",
				threshold: 800,
				windowMinutes: 1,
			})?.path,
		).toBe("windowMinutes");
		expect(
			ruleShapeProblem({
				trigger: "p95_above",
				threshold: 800,
				windowMinutes: 1,
			})?.code,
		).toBe("PERFORMANCE_WINDOW_MIN");
		expect(
			ruleShapeProblem({
				trigger: "p95_above",
				threshold: 800,
				windowMinutes: 15,
				transactionName: "/checkout",
			}),
		).toBeNull();
	});

	it("la tasa de errores es un porcentaje", () => {
		expect(
			ruleShapeProblem({
				trigger: "error_rate_above",
				threshold: 150,
				windowMinutes: 15,
			})?.code,
		).toBe("ERROR_RATE_RANGE");
		expect(
			ruleShapeProblem({
				trigger: "error_rate_above",
				threshold: 5,
				windowMinutes: 15,
			}),
		).toBeNull();
	});

	it("las reglas de rendimiento no tienen nivel mínimo", () => {
		expect(
			ruleShapeProblem({
				trigger: "p95_above",
				threshold: 800,
				windowMinutes: 15,
				minLevel: "error",
			})?.code,
		).toBe("PERFORMANCE_NO_LEVEL");
	});
});

describe("createRuleSchema / updateRuleSchema", () => {
	it("acepta una regla de rendimiento completa", () => {
		const parsed = createRuleSchema.parse({
			...base,
			trigger: "p95_above",
			threshold: 800,
			windowMinutes: 15,
			transactionName: "/checkout",
			environment: "production",
		});
		expect(parsed.transactionName).toBe("/checkout");
		expect(parsed.cooldownMinutes).toBe(60);
	});

	it("rechaza una regla de rendimiento sin umbral", () => {
		const res = createRuleSchema.safeParse({ ...base, trigger: "p95_above" });
		expect(res.success).toBe(false);
	});

	it("rechaza el umbral en una regla de issue nuevo", () => {
		const res = createRuleSchema.safeParse({
			...base,
			trigger: "new_issue",
			threshold: 3,
			windowMinutes: 5,
		});
		expect(res.success).toBe(false);
	});

	it("la edición admite quitar la transacción", () => {
		expect(updateRuleSchema.parse({ transactionName: null })).toEqual({
			transactionName: null,
		});
	});
});
