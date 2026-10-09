import { safeSerialize, stringify } from "./normalize";
import { parseStack } from "./stacktrace";
import type { ExceptionValue } from "./types";

const MAX_CAUSE_DEPTH = 5;

function isErrorLike(value: unknown): value is Error {
	if (value instanceof Error) return true;
	return (
		typeof value === "object" &&
		value !== null &&
		typeof (value as { message?: unknown }).message === "string" &&
		typeof (value as { name?: unknown }).name === "string"
	);
}

function describeError(error: Error, pageOrigin?: string): ExceptionValue {
	const frames = parseStack(error.stack, pageOrigin);
	return {
		type: error.name || error.constructor?.name || "Error",
		value: error.message,
		...(frames.length > 0 && { stacktrace: { frames } }),
	};
}

export interface ExceptionOptions {
	pageOrigin?: string;
	/** Tipo a usar cuando se captura algo que no es un Error. */
	nonErrorType?: string;
	nonErrorPrefix?: string;
}

/**
 * Convierte lo que se lanzó (Error, string, objeto...) en la cadena de excepciones
 * del servidor: las causas (`error.cause`) primero y la excepción principal al final.
 */
export function exceptionFromUnknown(
	thrown: unknown,
	options: ExceptionOptions = {},
): ExceptionValue[] {
	if (!isErrorLike(thrown)) {
		const prefix =
			options.nonErrorPrefix ?? "Non-Error exception captured with value: ";
		return [
			{
				type: options.nonErrorType ?? "Error",
				value: `${prefix}${stringify(thrown, 500)}`,
			},
		];
	}

	const chain: ExceptionValue[] = [];
	const seen = new Set<unknown>();
	let current: unknown = thrown;

	while (
		isErrorLike(current) &&
		!seen.has(current) &&
		chain.length <= MAX_CAUSE_DEPTH
	) {
		seen.add(current);
		chain.unshift(describeError(current, options.pageOrigin));
		current = (current as { cause?: unknown }).cause;
	}

	// Una causa que no es Error (p. ej. un string) también aporta contexto.
	if (
		current !== undefined &&
		!isErrorLike(current) &&
		chain.length <= MAX_CAUSE_DEPTH
	) {
		chain.unshift({
			type: "Error",
			value: stringify(safeSerialize(current), 500),
		});
	}
	return chain;
}
