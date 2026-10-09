import { TraceMap } from "@jridgewell/trace-mapping";
import type { IngestEvent } from "@sentinel/shared";
import { transformSync } from "esbuild";
import { describe, expect, it, vi } from "vitest";
import {
	cleanSourcePath,
	enclosingFunctionName,
	isInAppSource,
	symbolicateEvent,
} from "./symbolicate.js";

const SOURCE = `export function run(cart: { items?: number[] }) {
	// Bug a propósito: items puede ser undefined.
	function computeTotal(c: { items?: number[] }) {
		if (!c.items) {
			throw new Error("sin items");
		}
		return c.items.reduce((a, b) => a + b, 0);
	}
	const checkout = (id: number) => {
		return computeTotal(cart) + id;
	};
	return checkout(1);
}
`;

/** Compila con un minificador real: los nombres internos se acortan y se genera un mapa auténtico. */
function build(source = SOURCE, sourcefile = "../src/cart.ts") {
	const out = transformSync(source, {
		loader: "ts",
		minify: true,
		sourcemap: "external",
		sourcefile,
	});
	return { code: out.code, map: new TraceMap(out.map) };
}

/** Posición (línea y columna, ambas desde 1 como en el navegador) de un texto del código generado. */
function positionOf(code: string, needle: string, last = false) {
	const lines = code.split("\n");
	const line = lines.findIndex((l) => l.includes(needle));
	return {
		lineno: line + 1,
		colno:
			(last ? lines[line].lastIndexOf(needle) : lines[line].indexOf(needle)) +
			1,
	};
}

const eventWith = (
	frames: object[],
	over: Partial<IngestEvent> = {},
): IngestEvent => ({
	level: "error",
	release: "1.0.0",
	exception: {
		values: [{ type: "Error", value: "sin items", stacktrace: { frames } }],
	},
	...over,
});

describe("symbolicateEvent", () => {
	it("traduce la posición minificada al código original, con función y contexto", async () => {
		const { code, map } = build();
		const at = positionOf(code, "new Error");
		const event = eventWith([
			{
				filename: "https://app.example.com/assets/app.3f2a.js",
				function: "r",
				...at,
				in_app: true,
			},
		]);

		const result = await symbolicateEvent(event, async (name) =>
			name === "~/assets/app.3f2a.js" ? map : undefined,
		);
		const frame = result.exception?.values[0].stacktrace?.frames[0];

		expect(frame).toMatchObject({
			filename: "src/cart.ts",
			lineno: 5,
			function: "computeTotal",
			in_app: true,
			symbolicated: true,
			abs_path: "https://app.example.com/assets/app.3f2a.js",
			context_line: '\t\t\tthrow new Error("sin items");',
		});
		expect(frame?.pre_context?.at(-1)).toBe("\t\tif (!c.items) {");
		expect(frame?.post_context?.[0]).toBe("\t\t}");
		expect(frame?.pre_context).toHaveLength(4);
	});

	it("deduce el nombre de una función flecha y no pisa un nombre que ya es legible", async () => {
		const { code, map } = build();
		const arrowAt = positionOf(code, "+", true); // la suma final, dentro de checkout (flecha)
		const event = eventWith([
			{ filename: "https://a.com/x.js", function: "t", ...arrowAt },
			{ filename: "https://a.com/x.js", function: "CartPage", ...arrowAt },
		]);
		const frames = (await symbolicateEvent(event, async () => map)).exception
			?.values[0].stacktrace?.frames;
		expect(frames?.[0].function).toBe("checkout");
		// Un nombre legible se respeta: no se "corrige" con una suposición.
		expect(frames?.[1].function).toBe("CartPage");
	});

	it("el mismo error en dos builds distintos queda con los mismos frames originales", async () => {
		const a = build();
		const b = build(
			`// otra línea al inicio\n${SOURCE}`.replace(
				"// otra línea al inicio\n",
				"",
			),
			"../src/cart.ts",
		);
		const frameFor = async (built: ReturnType<typeof build>, file: string) => {
			const at = positionOf(built.code, "new Error");
			const r = await symbolicateEvent(
				eventWith([
					{ filename: `https://x.com/${file}`, function: "r", ...at },
				]),
				async () => built.map,
			);
			const f = r.exception?.values[0].stacktrace?.frames[0];
			return {
				filename: f?.filename,
				function: f?.function,
				lineno: f?.lineno,
			};
		};
		expect(await frameFor(a, "app.111.js")).toEqual(
			await frameFor(b, "app.222.js"),
		);
	});

	it("marca como ajeno el código de dependencias", async () => {
		const { code, map } = build(SOURCE, "../node_modules/lib/index.ts");
		const at = positionOf(code, "new Error");
		const result = await symbolicateEvent(
			eventWith([
				{ filename: "https://a.com/v.js", function: "r", ...at, in_app: true },
			]),
			async () => map,
		);
		expect(result.exception?.values[0].stacktrace?.frames[0]).toMatchObject({
			filename: "node_modules/lib/index.ts",
			in_app: false,
		});
	});

	it("deja intactos los frames sin mapa, sin posición o ya simbolizados", async () => {
		const { map } = build();
		const frames = [
			{
				filename: "https://a.com/sin-mapa.js",
				function: "a",
				lineno: 1,
				colno: 5,
			},
			{ filename: "https://a.com/x.js", function: "b" },
			{
				filename: "https://a.com/x.js",
				function: "c",
				lineno: 1,
				colno: 5,
				symbolicated: true,
				in_app: true,
			},
			{ function: "d", lineno: 1, colno: 1 },
		];
		const resolve = vi.fn(async (name: string) =>
			name === "~/x.js" ? map : undefined,
		);
		const result = await symbolicateEvent(eventWith(frames), resolve);
		expect(result.exception?.values[0].stacktrace?.frames).toEqual(frames);
	});

	it("una posición que el mapa no conoce no inventa nada", async () => {
		const { map } = build();
		const frames = [
			{ filename: "https://a.com/x.js", function: "a", lineno: 999, colno: 1 },
		];
		const result = await symbolicateEvent(eventWith(frames), async () => map);
		expect(
			result.exception?.values[0].stacktrace?.frames[0].symbolicated,
		).toBeUndefined();
	});

	it("sin release o sin excepción no hace nada", async () => {
		const resolve = vi.fn();
		const noRelease = eventWith(
			[{ filename: "https://a.com/x.js", lineno: 1, colno: 1 }],
			{ release: undefined },
		);
		expect(await symbolicateEvent(noRelease, resolve)).toBe(noRelease);
		const message: IngestEvent = {
			level: "info",
			message: "hola",
			release: "1.0.0",
		};
		expect(await symbolicateEvent(message, resolve)).toBe(message);
		expect(resolve).not.toHaveBeenCalled();
	});

	it("busca cada archivo una sola vez, aunque tenga muchos frames", async () => {
		const { code, map } = build();
		const at = positionOf(code, "new Error");
		const frames = Array.from({ length: 5 }, () => ({
			filename: "https://a.com/x.js?v=1",
			function: "r",
			...at,
		}));
		const resolve = vi.fn(async () => map);
		await symbolicateEvent(eventWith(frames), resolve);
		expect(resolve).toHaveBeenCalledTimes(1);
		expect(resolve).toHaveBeenCalledWith("~/x.js");
	});

	it("simboliza también las causas encadenadas", async () => {
		const { code, map } = build();
		const at = positionOf(code, "new Error");
		const event: IngestEvent = {
			level: "error",
			release: "1.0.0",
			exception: {
				values: [
					{
						type: "Cause",
						stacktrace: {
							frames: [
								{ filename: "https://a.com/x.js", function: "r", ...at },
							],
						},
					},
					{
						type: "Main",
						stacktrace: {
							frames: [
								{ filename: "https://a.com/x.js", function: "r", ...at },
							],
						},
					},
				],
			},
		};
		const result = await symbolicateEvent(event, async () => map);
		for (const v of result.exception?.values ?? [])
			expect(v.stacktrace?.frames[0].filename).toBe("src/cart.ts");
	});

	it("es idempotente: simbolizar dos veces da lo mismo", async () => {
		const { code, map } = build();
		const at = positionOf(code, "new Error");
		const once = await symbolicateEvent(
			eventWith([{ filename: "https://a.com/x.js", function: "r", ...at }]),
			async () => map,
		);
		expect(await symbolicateEvent(once, async () => map)).toEqual(once);
	});
});

describe("cleanSourcePath", () => {
	it("deja solo la ruta del proyecto", () => {
		expect(cleanSourcePath("webpack:///./src/a.ts")).toBe("src/a.ts");
		expect(cleanSourcePath("webpack://mi-app/./src/a.ts")).toBe("src/a.ts");
		expect(cleanSourcePath("../../src/a.ts")).toBe("src/a.ts");
		expect(cleanSourcePath("file:///app/src/a.ts?v=2")).toBe("app/src/a.ts");
		expect(cleanSourcePath("src/a.ts")).toBe("src/a.ts");
	});
});

describe("isInAppSource", () => {
	it("excluye dependencias y código interno del empaquetador", () => {
		expect(isInAppSource("src/a.ts")).toBe(true);
		expect(isInAppSource("node_modules/react/index.js")).toBe(false);
		expect(isInAppSource("../node_modules/.pnpm/x/y.js")).toBe(false);
		expect(isInAppSource("webpack/bootstrap")).toBe(false);
	});
});

describe("enclosingFunctionName", () => {
	const find = (code: string, line: number) =>
		enclosingFunctionName(code.split("\n"), line);

	it("reconoce declaraciones, flechas, expresiones y métodos", () => {
		expect(find("function alpha(a) {\n  boom();\n}", 2)).toBe("alpha");
		expect(find("export async function beta() {\n  boom();\n}", 2)).toBe(
			"beta",
		);
		expect(find("const gamma = async (x) => {\n  boom();\n};", 2)).toBe(
			"gamma",
		);
		expect(find("const delta = function () {\n  boom();\n};", 2)).toBe("delta");
		expect(
			find("class A {\n  async epsilon(x: number) {\n    boom();\n  }\n}", 3),
		).toBe("epsilon");
	});

	it("no confunde sentencias de control con funciones", () => {
		expect(find("function real() {\n  if (x) {\n    boom();\n  }\n}", 3)).toBe(
			"real",
		);
		expect(find("for (const a of b) {\n  boom();\n}", 2)).toBeUndefined();
	});

	it("elige la función más cercana hacia atrás", () => {
		expect(
			find("function outer() {\n  function inner() {\n    boom();\n  }\n}", 3),
		).toBe("inner");
	});
});
