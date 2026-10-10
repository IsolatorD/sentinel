import { describe, expect, it } from "vitest";
import { isInApp, parseStack } from "./stacktrace";

const ORIGIN = "https://app.example.com";

describe("parseStack", () => {
	it("formato V8 (Chrome/Edge/Node): invierte el orden y detecta in_app", () => {
		const stack = [
			"TypeError: Cannot read properties of undefined (reading 'total')",
			"    at computeTotal (https://app.example.com/assets/Cart.js:42:17)",
			"    at Array.map (<anonymous>)",
			"    at https://app.example.com/assets/main.js:10:5",
			"    at HTMLButtonElement.onClick (https://app.example.com/assets/Cart.js:90:3)",
		].join("\n");

		const frames = parseStack(stack, ORIGIN);
		expect(frames).toHaveLength(4);
		// El último frame es donde se lanzó el error.
		expect(frames.at(-1)).toEqual({
			function: "computeTotal",
			filename: "https://app.example.com/assets/Cart.js",
			lineno: 42,
			colno: 17,
			in_app: true,
		});
		expect(frames[0]).toMatchObject({
			function: "HTMLButtonElement.onClick",
			lineno: 90,
		});
		// Frame anónimo sin función.
		expect(frames[1]).toMatchObject({
			filename: "https://app.example.com/assets/main.js",
			lineno: 10,
		});
		expect(frames[1].function).toBeUndefined();
		// Código nativo: no es de la app.
		expect(frames[2]).toMatchObject({
			function: "Array.map",
			filename: "<anonymous>",
			in_app: false,
		});
	});

	it("formato V8 con async, new y eval", () => {
		const stack = [
			"Error: x",
			"    at async loadUser (https://app.example.com/a.js:5:9)",
			"    at new Store (https://app.example.com/b.js:7:1)",
			"    at eval (eval at run (https://app.example.com/c.js:1:1), <anonymous>:1:1)",
		].join("\n");
		const frames = parseStack(stack, ORIGIN);
		expect(frames.map((f) => f.function)).toEqual([
			"eval",
			"new Store",
			"loadUser",
		]);
		expect(frames[0].filename).toBe("<anonymous>");
	});

	it("formato Firefox / Safari", () => {
		const stack = [
			"computeTotal@https://app.example.com/assets/Cart.js:42:17",
			"@https://app.example.com/assets/main.js:10:5",
			"forEach@[native code]",
			"global code@https://app.example.com/assets/main.js:99:1",
		].join("\n");
		const frames = parseStack(stack, ORIGIN);
		expect(frames).toHaveLength(4);
		expect(frames.at(-1)).toMatchObject({
			function: "computeTotal",
			lineno: 42,
			colno: 17,
			in_app: true,
		});
		expect(frames[0]).toMatchObject({ function: "global code", lineno: 99 });
		expect(frames[1]).toMatchObject({
			function: "forEach",
			filename: "[native code]",
			in_app: false,
		});
		expect(frames[2].function).toBeUndefined();
	});

	it("maneja URLs con puerto y sin número de columna", () => {
		const frames = parseStack(
			"Error: x\n    at fn (http://localhost:5173/src/App.tsx:12)",
			"http://localhost:5173",
		);
		expect(frames[0]).toMatchObject({
			filename: "http://localhost:5173/src/App.tsx",
			lineno: 12,
			in_app: true,
		});
		expect(frames[0].colno).toBeUndefined();
	});

	it("devuelve [] sin stack o sin frames reconocibles", () => {
		expect(parseStack(undefined)).toEqual([]);
		expect(parseStack("")).toEqual([]);
		expect(parseStack("Error: sin stack")).toEqual([]);
	});

	it("limita a 250 frames conservando los más cercanos al error", () => {
		const lines = Array.from(
			{ length: 400 },
			(_, i) => `    at f${i} (https://app.example.com/a.js:${i + 1}:1)`,
		);
		const frames = parseStack(["Error: x", ...lines].join("\n"), ORIGIN);
		expect(frames).toHaveLength(250);
		// El frame 0 del stack (el más reciente) queda al final.
		expect(frames.at(-1)?.function).toBe("f0");
	});
});

describe("isInApp", () => {
	it("excluye librerías, extensiones, código nativo y otros orígenes", () => {
		expect(isInApp("https://app.example.com/a.js", ORIGIN)).toBe(true);
		expect(isInApp("webpack:///./src/a.ts", ORIGIN)).toBe(true);
		expect(
			isInApp("https://app.example.com/node_modules/lib/x.js", ORIGIN),
		).toBe(false);
		expect(isInApp("https://cdn.otro.com/a.js", ORIGIN)).toBe(false);
		expect(isInApp("chrome-extension://abc/content.js", ORIGIN)).toBe(false);
		expect(isInApp("moz-extension://abc/content.js", ORIGIN)).toBe(false);
		expect(isInApp("<anonymous>", ORIGIN)).toBe(false);
		expect(isInApp("[native code]", ORIGIN)).toBe(false);
		expect(isInApp(undefined, ORIGIN)).toBe(false);
	});
});

describe("Hermes y código nativo", () => {
	it("lee el formato de Hermes (address at ...) y no marca como código propio lo nativo", () => {
		const frames = parseStack(
			[
				"Error: boom",
				"    at onPress (address at index.android.bundle:1:2345)",
				"    at anonymous (address at /data/user/0/app/files/index.android.bundle:1:99)",
				"    at apply (native)",
			].join("\n"),
		);
		// Del más antiguo al más reciente.
		expect(
			frames.map((f) => [f.function, f.filename, f.lineno, f.colno, f.in_app]),
		).toEqual([
			["apply", "native", undefined, undefined, false],
			["anonymous", "/data/user/0/app/files/index.android.bundle", 1, 99, true],
			["onPress", "index.android.bundle", 1, 2345, true],
		]);
	});
});
