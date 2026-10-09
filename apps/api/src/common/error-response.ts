import { HttpException } from "@nestjs/common";
import {
	DEFAULT_LOCALE,
	type ErrorResponse,
	isMessageCode,
	type Locale,
	type MessageCode,
	translate,
} from "@sentinel/shared";
import { localizeIssues } from "./zod-locale.js";
import { ZodValidationException } from "./zod-validation.pipe.js";

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

/** Estados cuyo mensaje es siempre el genérico, sin importar qué librería lo produjo. */
const GENERIC_REASON: Record<number, MessageCode> = {
	413: "PAYLOAD_TOO_LARGE",
	415: "UNSUPPORTED_MEDIA_TYPE",
	429: "TOO_MANY_REQUESTS",
};
/** Mensajes por defecto de Nest para estos estados: se traducen; uno propio se respeta. */
const DEFAULT_TEXT: Record<number, [RegExp, MessageCode]> = {
	401: [/^unauthorized$/i, "UNAUTHORIZED"],
	403: [/^forbidden$/i, "FORBIDDEN"],
	404: [/^not found$/i, "NOT_FOUND"],
};

type Issue = { path: string; message: string };

function isIssues(value: unknown): value is Issue[] {
	return (
		Array.isArray(value) &&
		value.every(
			(v) => typeof v?.path === "string" && typeof v?.message === "string",
		)
	);
}

function paramsOf(value: unknown): Record<string, string | number> {
	return typeof value === "object" && value !== null
		? (value as Record<string, string | number>)
		: {};
}

/** El código específico del error: el que pidió quien lo lanzó, o el genérico de su estado. */
function resolveReason(
	status: number,
	requested: unknown,
	message: string,
): MessageCode | undefined {
	if (isMessageCode(requested)) return requested;
	if (GENERIC_REASON[status]) return GENERIC_REASON[status];
	if (status >= 500) return "INTERNAL_ERROR";
	const fallback = DEFAULT_TEXT[status];
	return fallback?.[0].test(message) ? fallback[1] : undefined;
}

export interface MappedError {
	status: number;
	body: Omit<ErrorResponse, "requestId">;
	/** Error inesperado (5xx) que conviene registrar con su stack. */
	unexpected: boolean;
}

/** Convierte cualquier excepción en el formato de error único de la API. */
export function toErrorResponse(
	exception: unknown,
	locale: Locale = DEFAULT_LOCALE,
): MappedError {
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

		// Un error de validación: sus mensajes se redactan en el idioma de la petición.
		if (exception instanceof ZodValidationException) {
			return {
				status,
				unexpected: false,
				body: {
					statusCode: status,
					code: "VALIDATION_FAILED",
					reason: "VALIDATION_FAILED",
					message: translate(locale, "VALIDATION_FAILED"),
					issues: localizeIssues(exception.schema, exception.value, locale),
				},
			};
		}

		const issues = isIssues(obj.issues) ? obj.issues : undefined;
		const reason = resolveReason(status, obj.reason, message);
		return {
			status,
			unexpected: status >= 500,
			body: {
				statusCode: status,
				code: issues ? "VALIDATION_FAILED" : codeForStatus(status),
				...(reason && { reason }),
				message: reason
					? translate(locale, reason, paramsOf(obj.params))
					: message,
				...(issues && { issues }),
			},
		};
	}

	// Errores de Fastify (p. ej. cuerpo demasiado grande) traen su propio statusCode.
	const status = (exception as { statusCode?: unknown })?.statusCode;
	if (typeof status === "number" && status >= 400 && status < 500) {
		const reason = GENERIC_REASON[status];
		return {
			status,
			unexpected: false,
			body: {
				statusCode: status,
				code: codeForStatus(status),
				...(reason && { reason }),
				message: reason
					? translate(locale, reason)
					: (exception as Error).message,
			},
		};
	}

	return {
		status: 500,
		unexpected: true,
		body: {
			statusCode: 500,
			code: "INTERNAL_ERROR",
			reason: "INTERNAL_ERROR",
			message: translate(locale, "INTERNAL_ERROR"),
		},
	};
}
