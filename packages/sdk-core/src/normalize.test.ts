// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
	LIMITS,
	normalizeEvent,
	safeSerialize,
	stringify,
	truncate,
} from "./normalize";
import type { SentinelEvent } from "./types";

describe("truncate", () => {
	it("recorta y marca con …", () => {
		expect(truncate("abcdef", 4)).toBe("abc…");
		expect(truncate("abc", 4)).toBe("abc");
	});
});

describe("safeSerialize", () => {
	it("maneja ciclos", () => {
		const a: Record<string, unknown> = { name: "a" };
		a.self = a;
		expect(safeSerialize(a)).toEqual({ name: "a", self: "[Circular]" });
	});

	it("convierte tipos no serializables", () => {
		const out = safeSerialize({
			fn: function hola() {},
			big: 10n,
			sym: Symbol("s"),
			nan: Number.NaN,
			date: new Date("2026-01-01T00:00:00Z"),
			err: new Error("x"),
			undef: undefined,
		}) as Record<string, unknown>;
		expect(out).toMatchObject({
			fn: "[Function hola]",
			big: "10n",
			sym: "Symbol(s)",
			nan: "NaN",
			date: "2026-01-01T00:00:00.000Z",
			err: { name: "Error", message: "x" },
		});
		expect(() => JSON.stringify(out)).not.toThrow();
	});

	it("limita profundidad, largo de arrays y de strings", () => {
		const deep = { a: { b: { c: { d: { e: 1 } } } } };
		expect(JSON.stringify(safeSerialize(deep, 2))).toContain("[Object]");
		expect(
			(safeSerialize(Array.from({ length: 100 }, (_, i) => i)) as unknown[])
				.length,
		).toBe(20);
		expect((safeSerialize("x".repeat(5_000)) as string).length).toBe(1_000);
	});

	it("describe elementos del DOM sin recorrerlos", () => {
		expect(safeSerialize(document.createElement("button"))).toBe(
			"[Element button]",
		);
	});

	it("no lanza con getters que fallan", () => {
		const obj = {
			get boom(): string {
				throw new Error("no");
			},
		};
		expect(safeSerialize(obj)).toEqual({ boom: "[Unreadable]" });
	});
});

describe("stringify", () => {
	it("devuelve texto legible de cualquier valor", () => {
		expect(stringify("hola")).toBe("hola");
		expect(stringify({ a: 1 })).toBe('{"a":1}');
		expect(stringify(42)).toBe("42");
		expect(stringify(undefined)).toBe("undefined");
	});
});

const base = (over: Partial<SentinelEvent> = {}): SentinelEvent => ({
	level: "error",
	...over,
});

describe("normalizeEvent", () => {
	it("recorta los campos a los límites del servidor", () => {
		const e = normalizeEvent(
			base({
				message: "m".repeat(20_000),
				release: "r".repeat(500),
				tags: { [`k${"x".repeat(100)}`]: "v".repeat(1_000) },
				exception: {
					values: [
						{
							type: "T".repeat(400),
							value: "v".repeat(20_000),
							stacktrace: {
								frames: [
									{ filename: "f".repeat(3_000), function: "g".repeat(500) },
								],
							},
						},
					],
				},
			}),
		);
		expect(e.message?.length).toBe(LIMITS.long);
		expect(e.release?.length).toBe(LIMITS.short);
		expect(Object.keys(e.tags ?? {})[0].length).toBe(LIMITS.tagKey);
		expect(Object.values(e.tags ?? {})[0].length).toBe(LIMITS.tagValue);
		const v = e.exception?.values[0];
		expect(v?.type.length).toBe(LIMITS.short);
		expect(v?.value?.length).toBe(LIMITS.long);
		expect(v?.stacktrace?.frames[0].filename?.length).toBe(LIMITS.medium);
		expect(v?.stacktrace?.frames[0].function?.length).toBe(LIMITS.short);
	});

	it("limita cantidades (frames, excepciones, breadcrumbs, fingerprint)", () => {
		const frames = Array.from({ length: 400 }, (_, i) => ({
			function: `f${i}`,
		}));
		const e = normalizeEvent(
			base({
				exception: {
					values: Array.from({ length: 15 }, (_, i) => ({
						type: `E${i}`,
						stacktrace: { frames },
					})),
				},
				breadcrumbs: Array.from({ length: 150 }, (_, i) => ({
					message: `b${i}`,
				})),
				fingerprint: Array.from({ length: 20 }, (_, i) => `f${i}`),
			}),
		);
		expect(e.exception?.values).toHaveLength(LIMITS.exceptionValues);
		// Se conservan las excepciones y frames más recientes (el final de la lista).
		expect(e.exception?.values.at(-1)?.type).toBe("E14");
		expect(e.exception?.values[0].stacktrace?.frames).toHaveLength(
			LIMITS.frames,
		);
		expect(e.exception?.values[0].stacktrace?.frames.at(-1)?.function).toBe(
			"f399",
		);
		expect(e.breadcrumbs).toHaveLength(LIMITS.breadcrumbs);
		expect(e.breadcrumbs?.at(-1)?.message).toBe("b149");
		expect(e.fingerprint).toHaveLength(LIMITS.fingerprint);
	});

	it("serializa de forma segura extra, contexts y datos de breadcrumbs", () => {
		const circular: Record<string, unknown> = {};
		circular.me = circular;
		const e = normalizeEvent(
			base({
				extra: { circular },
				contexts: { app: { fn: () => 1 } },
				breadcrumbs: [{ data: { circular } }],
			}),
		);
		expect(() => JSON.stringify(e)).not.toThrow();
		expect(e.extra).toEqual({ circular: { me: "[Circular]" } });
	});

	it("si el evento excede el tamaño máximo, descarta lo menos importante primero", () => {
		const huge = Object.fromEntries(
			Array.from({ length: 30 }, (_, i) => [`k${i}`, "x".repeat(1_000)]),
		);
		const big = normalizeEvent(
			base({
				message: "importante",
				extra: Object.fromEntries(
					Array.from({ length: 30 }, (_, i) => [`e${i}`, huge]),
				),
			}),
		);
		expect(JSON.stringify(big).length).toBeLessThanOrEqual(LIMITS.maxBytes);
		expect(big.message).toBe("importante");
	});
});
