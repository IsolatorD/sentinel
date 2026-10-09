import { describe, expect, it } from "vitest";
import { containsPattern, escapeLike } from "./search.js";

describe("escapeLike", () => {
	it("escapa los comodines para que la búsqueda sea literal", () => {
		expect(escapeLike("100%")).toBe("100\\%");
		expect(escapeLike("a_b")).toBe("a\\_b");
		expect(escapeLike("c:\\ruta")).toBe("c:\\\\ruta");
		expect(escapeLike("normal")).toBe("normal");
	});

	it("containsPattern envuelve el texto escapado", () => {
		expect(containsPattern("50%_x")).toBe("%50\\%\\_x%");
	});
});
