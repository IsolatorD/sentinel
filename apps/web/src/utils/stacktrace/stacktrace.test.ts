import type { StackFrame } from "@sentinel/shared";
import { describe, expect, it } from "vitest";
import {
	contextLines,
	framesForDisplay,
	shortLocation,
} from "@/utils/stacktrace/stacktrace";

// Orden del servidor: del más antiguo al más reciente.
const frames: StackFrame[] = [
	{
		filename: "node_modules/react-dom.js",
		function: "beginWork",
		in_app: false,
	},
	{
		filename: "https://app.com/assets/Cart.js",
		function: "CartPage",
		lineno: 88,
		in_app: true,
	},
	{
		filename: "https://app.com/assets/Cart.js",
		function: "computeTotal",
		lineno: 42,
		in_app: true,
	},
];

describe("framesForDisplay", () => {
	it("muestra primero donde se lanzó el error y solo el código propio", () => {
		const { frames: shown, hidden } = framesForDisplay(frames, false);
		expect(shown.map((f) => f.function)).toEqual(["computeTotal", "CartPage"]);
		expect(hidden).toBe(1);
	});

	it("con showAll muestra todos, también invertidos", () => {
		const { frames: shown, hidden } = framesForDisplay(frames, true);
		expect(shown.map((f) => f.function)).toEqual([
			"computeTotal",
			"CartPage",
			"beginWork",
		]);
		expect(hidden).toBe(0);
	});

	it("si ninguno es código propio, muestra todos para no dejar la pila vacía", () => {
		const libOnly = frames.map((f) => ({ ...f, in_app: false }));
		expect(framesForDisplay(libOnly, false)).toMatchObject({
			hidden: 0,
			frames: expect.any(Array),
		});
		expect(framesForDisplay(libOnly, false).frames).toHaveLength(3);
	});

	it("conserva el índice original de cada frame", () => {
		expect(framesForDisplay(frames, true).frames.map((f) => f.index)).toEqual([
			2, 1, 0,
		]);
	});
});

describe("shortLocation", () => {
	it("deja solo archivo, línea y columna", () => {
		expect(
			shortLocation({
				filename: "https://app.com/assets/Cart.js?v=3",
				lineno: 42,
				colno: 17,
			}),
		).toBe("Cart.js:42:17");
		expect(
			shortLocation({ filename: "https://app.com/a/b.js", lineno: 5 }),
		).toBe("b.js:5");
		expect(shortLocation({})).toBe("?");
	});
});

describe("frames simbolizados", () => {
	it("muestran la ruta del proyecto completa en lugar de solo el nombre del archivo", () => {
		expect(
			shortLocation({
				filename: "src/cart/Total.ts",
				lineno: 4,
				colno: 7,
				symbolicated: true,
			}),
		).toBe("src/cart/Total.ts:4:7");
	});
});

describe("contextLines", () => {
	it("numera las líneas alrededor de la que falló", () => {
		const lines = contextLines({
			lineno: 10,
			context_line: "boom();",
			pre_context: ["a", "b"],
			post_context: ["c"],
		});
		expect(lines).toEqual([
			{ number: 8, text: "a", highlight: false },
			{ number: 9, text: "b", highlight: false },
			{ number: 10, text: "boom();", highlight: true },
			{ number: 11, text: "c", highlight: false },
		]);
	});

	it("funciona sin líneas previas ni posteriores", () => {
		expect(contextLines({ lineno: 1, context_line: "x" })).toEqual([
			{ number: 1, text: "x", highlight: true },
		]);
	});

	it("sin contexto o sin número de línea no devuelve nada", () => {
		expect(contextLines({ lineno: 3 })).toEqual([]);
		expect(contextLines({ context_line: "x" })).toEqual([]);
	});
});
