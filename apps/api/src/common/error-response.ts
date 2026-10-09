import { HttpException } from "@nestjs/common";
import type { ErrorResponse } from "@sentinel/shared";

const CODES: Record<number, string> = {
	400: "BAD_REQUEST",
	401: "UNAUTHORIZED",
	403: "FORBIDDEN",
	404: "NOT_FOUND",
	409: "CONFLICT",
	413: "PAYLOAD_TOO_LARGE",
	415: "UNSUPPORTED_MEDIA_TYPE",
	422: "UNPROCESSABLE_ENTITY",
	429: "TOO_MANY_REQUESTS",
};

export function codeForStatus(status: number): string {
	if (status >= 500) return "INTERNAL_ERROR";
	return CODES[status] ?? `HTTP_${status}`;
}

type Issue = { path: string; message: string };

function isIssues(value: unknown): value is Issue[] {
	return (
		Array.isArray(value) &&
		value.every(
			(v) => typeof v?.path === "string" && typeof v?.message === "string",
		)
	);
}

export interface MappedError {
	status: number;
	body: Omit<ErrorResponse, "requestId">;
	/** Error inesperado (5xx) que conviene registrar con su stack. */
	unexpected: boolean;
}

/** Convierte cualquier excepción en el formato de error único de la API. */
export function toErrorResponse(exception: unknown): MappedError {
	if (exception instanceof HttpException) {
		const status = exception.getStatus();
		const res = exception.getResponse();
		const obj =
			typeof res === "object" && res !== null
				? (res as Record<string, unknown>)
				: {};
		const rawMessage = typeof res === "string" ? res : obj.message;
		const message = Array.isArray(rawMessage)
			? rawMessage.join(", ")
			: typeof rawMessage === "string"
				? rawMessage
				: exception.message;
		const issues = isIssues(obj.issues) ? obj.issues : undefined;
		return {
			status,
			unexpected: status >= 500,
			body: {
				statusCode: status,
				code: issues ? "VALIDATION_FAILED" : codeForStatus(status),
				message,
				...(issues && { issues }),
			},
		};
	}

	// Errores de Fastify (p. ej. cuerpo demasiado grande) traen su propio statusCode.
	const status = (exception as { statusCode?: unknown })?.statusCode;
	if (typeof status === "number" && status >= 400 && status < 500) {
		return {
			status,
			unexpected: false,
			body: {
				statusCode: status,
				code: codeForStatus(status),
				message: (exception as Error).message,
			},
		};
	}

	return {
		status: 500,
		unexpected: true,
		body: {
			statusCode: 500,
			code: "INTERNAL_ERROR",
			message: "Internal server error",
		},
	};
}
