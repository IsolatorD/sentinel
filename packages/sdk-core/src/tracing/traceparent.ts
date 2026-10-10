/** Cabecera W3C `traceparent`: `00-<traza 32 hex>-<span 16 hex>-<flags 2 hex>`. */
const TRACEPARENT = /^([\da-f]{2})-([\da-f]{32})-([\da-f]{16})-([\da-f]{2})$/i;

export interface IncomingTrace {
	traceId: string;
	/** El span que hizo la petición: será el padre de la transacción que la atiende. */
	parentSpanId: string;
	/** El que originó la traza decidió registrarla (bit `sampled`). */
	sampled: boolean;
}

/** Lee `traceparent`; devuelve `undefined` si no es válido (ids a cero incluidos). */
export function parseTraceparent(
	header: string | undefined | null,
): IncomingTrace | undefined {
	const match = header ? TRACEPARENT.exec(header.trim()) : null;
	if (!match) return undefined;
	const [, version, traceId, parentSpanId, flags] = match;
	if (version.toLowerCase() === "ff") return undefined;
	if (/^0+$/.test(traceId) || /^0+$/.test(parentSpanId)) return undefined;
	return {
		traceId: traceId.toLowerCase(),
		parentSpanId: parentSpanId.toLowerCase(),
		sampled: (Number.parseInt(flags, 16) & 1) === 1,
	};
}

export function formatTraceparent(
	traceId: string,
	spanId: string,
	sampled = true,
): string {
	return `00-${traceId}-${spanId}-${sampled ? "01" : "00"}`;
}
