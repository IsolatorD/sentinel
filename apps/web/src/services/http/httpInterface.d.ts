import type { z } from "zod";

export interface RequestOptions<S extends z.ZodType | undefined> {
	method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
	body?: unknown;
	/** Esquema con el que se valida la respuesta (los mismos que usa el backend). */
	schema?: S;
	query?: Record<string, string | number | undefined>;
	signal?: AbortSignal;
}
