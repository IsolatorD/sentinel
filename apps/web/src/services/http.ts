import { type ErrorResponse, errorResponseSchema } from "@sentinel/shared";
import axios, { type AxiosResponse } from "axios";
import type { z } from "zod";
import { ApiError } from "@/utils/apiError/apiError";

interface RequestOptions<S extends z.ZodType | undefined> {
	method?: "GET" | "POST" | "PATCH" | "DELETE";
	body?: unknown;
	/** Esquema con el que se valida la respuesta (los mismos que usa el backend). */
	schema?: S;
	query?: Record<string, string | number | undefined>;
	signal?: AbortSignal;
}

/**
 * Instancia compartida: cookies de sesión en cada petición y sin que axios lance por el estado HTTP
 * (el formato de error del backend se interpreta en `http`, no en un interceptor).
 */
export const apiClient = axios.create({
	withCredentials: true,
	validateStatus: () => true,
});

/** Quita los parámetros vacíos o indefinidos para que no aparezcan en la URL. */
function cleanQuery(query: RequestOptions<undefined>["query"]) {
	if (!query) return undefined;
	return Object.fromEntries(
		Object.entries(query).filter(([, v]) => v !== undefined && v !== ""),
	);
}

function toApiError(res: AxiosResponse): ApiError {
	const parsed = errorResponseSchema.safeParse(res.data);
	const body: ErrorResponse | undefined = parsed.success
		? parsed.data
		: undefined;
	return new ApiError(
		res.status,
		body?.message ?? res.statusText ?? "Request failed",
		body?.code,
		body?.issues,
		body?.requestId,
	);
}

/** Cliente HTTP mínimo: cookies de sesión, JSON y errores tipados. */
export async function http<S extends z.ZodType | undefined = undefined>(
	path: string,
	options: RequestOptions<S> = {},
): Promise<S extends z.ZodType ? z.infer<S> : undefined> {
	const res = await apiClient.request({
		url: path,
		method: options.method ?? (options.body !== undefined ? "POST" : "GET"),
		params: cleanQuery(options.query),
		data: options.body,
		signal: options.signal,
	});

	if (res.status >= 400) throw toApiError(res);
	if (res.status === 204 || !options.schema) return undefined as never;
	return options.schema.parse(res.data) as never;
}
