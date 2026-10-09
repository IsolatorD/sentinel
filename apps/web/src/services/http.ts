import { type ErrorResponse, errorResponseSchema } from "@sentinel/shared";
import type { z } from "zod";
import { ApiError } from "@/lib/api-error";

interface RequestOptions<S extends z.ZodType | undefined> {
	method?: "GET" | "POST" | "PATCH" | "DELETE";
	body?: unknown;
	/** Esquema con el que se valida la respuesta (los mismos que usa el backend). */
	schema?: S;
	query?: Record<string, string | number | undefined>;
	signal?: AbortSignal;
}

function buildPath(
	path: string,
	query?: RequestOptions<undefined>["query"],
): string {
	if (!query) return path;
	const params = new URLSearchParams();
	for (const [key, value] of Object.entries(query)) {
		if (value !== undefined && value !== "") params.set(key, String(value));
	}
	const qs = params.toString();
	return qs ? `${path}?${qs}` : path;
}

/** Cliente HTTP mínimo: cookies de sesión, JSON y errores tipados. */
export async function http<S extends z.ZodType | undefined = undefined>(
	path: string,
	options: RequestOptions<S> = {},
): Promise<S extends z.ZodType ? z.infer<S> : undefined> {
	const res = await fetch(buildPath(path, options.query), {
		method: options.method ?? (options.body !== undefined ? "POST" : "GET"),
		credentials: "include",
		headers:
			options.body !== undefined
				? { "Content-Type": "application/json" }
				: undefined,
		body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
		signal: options.signal,
	});

	if (!res.ok) {
		let parsed: ErrorResponse | undefined;
		try {
			parsed = errorResponseSchema.parse(await res.json());
		} catch {
			parsed = undefined;
		}
		throw new ApiError(
			res.status,
			parsed?.message ?? res.statusText ?? "Request failed",
			parsed?.code,
			parsed?.issues,
			parsed?.requestId,
		);
	}

	if (res.status === 204 || !options.schema) return undefined as never;
	return options.schema.parse(await res.json()) as never;
}
