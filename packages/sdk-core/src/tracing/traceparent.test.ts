import { describe, expect, it } from "vitest";
import { formatTraceparent, parseTraceparent } from "./traceparent";

const TRACE = "4bf92f3577b34da6a3ce929d0e0e4736";
const SPAN = "00f067aa0ba902b7";

describe("parseTraceparent", () => {
	it("lee la traza, el span padre y el bit de muestreo", () => {
		expect(parseTraceparent(`00-${TRACE}-${SPAN}-01`)).toEqual({
			traceId: TRACE,
			parentSpanId: SPAN,
			sampled: true,
		});
		expect(parseTraceparent(`00-${TRACE}-${SPAN}-00`)?.sampled).toBe(false);
	});

	it("tolera mayúsculas y espacios, y normaliza a minúsculas", () => {
		expect(
			parseTraceparent(` 00-${TRACE.toUpperCase()}-${SPAN.toUpperCase()}-01 `),
		).toMatchObject({
			traceId: TRACE,
			parentSpanId: SPAN,
		});
	});

	it("rechaza lo mal formado, los ids a cero y la versión ff", () => {
		for (const bad of [
			undefined,
			null,
			"",
			"nonsense",
			`00-${TRACE}-${SPAN}`,
			`00-${TRACE.slice(1)}-${SPAN}-01`,
			`00-${"0".repeat(32)}-${SPAN}-01`,
			`00-${TRACE}-${"0".repeat(16)}-01`,
			`ff-${TRACE}-${SPAN}-01`,
		])
			expect(parseTraceparent(bad)).toBeUndefined();
	});

	it("formatTraceparent es la inversa", () => {
		const header = formatTraceparent(TRACE, SPAN);
		expect(header).toBe(`00-${TRACE}-${SPAN}-01`);
		expect(parseTraceparent(header)?.traceId).toBe(TRACE);
		expect(formatTraceparent(TRACE, SPAN, false).endsWith("-00")).toBe(true);
	});
});
