import type { IngestEvent } from "@sentinel/shared";
import { describe, expect, it } from "vitest";
import {
	analyzeEvent,
	normalizeFilename,
	normalizeMessage,
	parseEventTimestamp,
} from "./fingerprint.js";

function exceptionEvent(
	over: Partial<{
		type: string;
		value: string;
		frames: Array<{
			filename?: string;
			function?: string;
			lineno?: number;
			in_app?: boolean;
		}>;
	}> = {},
): IngestEvent {
	return {
		level: "error",
		exception: {
			values: [
				{
					type: over.type ?? "TypeError",
					value: over.value ?? "Cannot read properties of undefined",
					stacktrace: {
						frames: over.frames ?? [
							{ filename: "node_modules/react/index.js", function: "render" },
							{
								filename: "https://app.example.com/assets/Cart.3f2a1b9c.js",
								function: "total",
								lineno: 42,
								in_app: true,
							},
						],
					},
				},
			],
		},
	};
}

describe("analyzeEvent / agrupación", () => {
	it("agrupa el mismo error aunque cambie la línea, el host o el hash del bundle", () => {
		const a = analyzeEvent(exceptionEvent());
		const b = analyzeEvent(
			exceptionEvent({
				frames: [
					{ filename: "node_modules/react/index.js", function: "render" },
					{
						filename: "https://staging.example.com/assets/Cart.99aabbcc.js?v=2",
						function: "total",
						lineno: 77,
						in_app: true,
					},
				],
			}),
		);
		expect(a.fingerprint).toBe(b.fingerprint);
	});

	it("agrupa aunque el mensaje tenga datos variables (si hay stacktrace, el mensaje no cuenta)", () => {
		const a = analyzeEvent(exceptionEvent({ value: "User 123 not found" }));
		const b = analyzeEvent(exceptionEvent({ value: "User 987 not found" }));
		expect(a.fingerprint).toBe(b.fingerprint);
	});

	it("separa errores distintos: otro tipo o otra función", () => {
		const base = analyzeEvent(exceptionEvent());
		expect(
			analyzeEvent(exceptionEvent({ type: "RangeError" })).fingerprint,
		).not.toBe(base.fingerprint);
		expect(
			analyzeEvent(
				exceptionEvent({
					frames: [{ filename: "Cart.js", function: "subtotal", in_app: true }],
				}),
			).fingerprint,
		).not.toBe(base.fingerprint);
	});

	it("ignora frames de librerías cuando hay frames in_app", () => {
		const a = analyzeEvent(exceptionEvent());
		const b = analyzeEvent(
			exceptionEvent({
				frames: [
					{ filename: "node_modules/otra-lib/x.js", function: "otra" },
					{
						filename: "https://otro.com/assets/Cart.12345678.js",
						function: "total",
						in_app: true,
					},
				],
			}),
		);
		expect(a.fingerprint).toBe(b.fingerprint);
	});

	it("sin stacktrace usa tipo + mensaje normalizado", () => {
		const mk = (value: string): IngestEvent => ({
			level: "error",
			exception: { values: [{ type: "Error", value }] },
		});
		expect(analyzeEvent(mk("Timeout after 3000ms")).fingerprint).toBe(
			analyzeEvent(mk("Timeout after 5000ms")).fingerprint,
		);
		expect(analyzeEvent(mk("Timeout after 3000ms")).fingerprint).not.toBe(
			analyzeEvent(mk("Connection refused")).fingerprint,
		);
	});

	it("eventos de mensaje agrupan por mensaje normalizado", () => {
		const mk = (message: string): IngestEvent => ({ level: "info", message });
		expect(analyzeEvent(mk("Order 1234 failed")).fingerprint).toBe(
			analyzeEvent(mk("Order 9 failed")).fingerprint,
		);
	});

	it("un fingerprint personalizado reemplaza al automático", () => {
		const a = analyzeEvent({ ...exceptionEvent(), fingerprint: ["checkout"] });
		const b = analyzeEvent({
			...exceptionEvent({ type: "RangeError" }),
			fingerprint: ["checkout"],
		});
		expect(a.fingerprint).toBe(b.fingerprint);
	});

	it("genera título y culprit legibles", () => {
		const r = analyzeEvent(exceptionEvent());
		expect(r.title).toBe("TypeError: Cannot read properties of undefined");
		expect(r.culprit).toBe("total (Cart.js:42)");
		expect(r.type).toBe("TypeError");
	});

	it("usa la última excepción de la cadena como principal", () => {
		const r = analyzeEvent({
			level: "error",
			exception: {
				values: [
					{ type: "DbError", value: "connection lost" },
					{ type: "ServiceError", value: "could not save" },
				],
			},
		});
		expect(r.type).toBe("ServiceError");
	});

	it("trunca títulos muy largos", () => {
		const r = analyzeEvent(exceptionEvent({ value: "x".repeat(1000) }));
		expect(r.title.length).toBeLessThanOrEqual(200);
	});
});

describe("normalización", () => {
	it("normalizeMessage", () => {
		expect(
			normalizeMessage(
				"Item 42 at 0xFF12 id 550e8400-e29b-41d4-a716-446655440000",
			),
		).toBe("Item <num> at <hex> id <uuid>");
		expect(normalizeMessage("primera línea\nsegunda 99")).toBe("primera línea");
	});

	it("normalizeFilename", () => {
		expect(
			normalizeFilename("https://a.com/assets/main.3f2a1b9c.js?x=1#y"),
		).toBe("/assets/main.js");
		expect(normalizeFilename("webpack:///./src/a.ts")).toBe("/./src/a.ts");
		expect(normalizeFilename(undefined)).toBe("<unknown>");
	});
});

describe("parseEventTimestamp", () => {
	const received = new Date("2026-10-09T12:00:00Z");

	it("acepta ISO, segundos y milisegundos", () => {
		expect(
			parseEventTimestamp("2026-10-09T11:00:00Z", received).toISOString(),
		).toBe("2026-10-09T11:00:00.000Z");
		expect(parseEventTimestamp(1_791_540_000, received).getTime()).toBe(
			1_791_540_000_000,
		);
		expect(parseEventTimestamp(1_791_540_000_000, received).getTime()).toBe(
			1_791_540_000_000,
		);
	});

	it("cae a la hora de recepción si es inválido, está ausente o es futuro", () => {
		expect(parseEventTimestamp("basura", received)).toBe(received);
		expect(parseEventTimestamp(undefined, received)).toBe(received);
		expect(parseEventTimestamp("2030-01-01T00:00:00Z", received)).toBe(
			received,
		);
	});
});
