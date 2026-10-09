import { describe, expect, it } from "vitest";
import { readStorage, writeStorage } from "./storage";

describe("storage", () => {
	it("lee y escribe, y nunca lanza si el almacenamiento falla", () => {
		writeStorage("k", "v");
		expect(readStorage("k")).toBe("v");
		const original = Storage.prototype.getItem;
		Storage.prototype.getItem = () => {
			throw new Error("bloqueado");
		};
		expect(readStorage("k")).toBeNull();
		Storage.prototype.getItem = original;
	});
});
