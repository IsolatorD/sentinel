import { describe, expect, it } from "vitest";
import { staggerStyle } from "./animation";

describe("staggerStyle", () => {
	it("cada fila espera un poco más que la anterior", () => {
		expect(staggerStyle(0)).toEqual({ animationDelay: "0ms" });
		expect(staggerStyle(1)).toEqual({ animationDelay: "30ms" });
		expect(staggerStyle(4)).toEqual({ animationDelay: "120ms" });
	});

	it("tiene un tope para que las listas largas no tarden en mostrarse", () => {
		expect(staggerStyle(8)).toEqual({ animationDelay: "240ms" });
		expect(staggerStyle(500)).toEqual({ animationDelay: "240ms" });
	});

	it("admite otro paso y otro tope", () => {
		expect(staggerStyle(3, 50, 2)).toEqual({ animationDelay: "100ms" });
	});
});
