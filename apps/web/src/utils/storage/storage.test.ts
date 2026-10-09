import { describe, expect, it } from "vitest";
import { readStorage, removeStorage, writeStorage } from "./storage";

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

	it("borra una clave y tampoco lanza si el almacenamiento falla", () => {
		writeStorage("k2", "v");
		removeStorage("k2");
		expect(readStorage("k2")).toBeNull();
		const original = Storage.prototype.removeItem;
		Storage.prototype.removeItem = () => {
			throw new Error("bloqueado");
		};
		expect(() => removeStorage("k2")).not.toThrow();
		Storage.prototype.removeItem = original;
	});
});
