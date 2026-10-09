import type { ApiBodyOptions } from "@nestjs/swagger";
import { z } from "zod";

type SchemaObject = Extract<ApiBodyOptions, { schema: unknown }>["schema"];

/**
 * Convierte un esquema Zod a JSON Schema (OpenAPI 3.0). Así los mismos esquemas
 * que validan las peticiones son la única fuente de la documentación.
 * `input` = lo que acepta la API (con defaults opcionales), `output` = lo que devuelve.
 */
export function jsonSchema(
	schema: z.ZodType,
	io: "input" | "output" = "output",
): SchemaObject {
	return z.toJSONSchema(schema, {
		target: "openapi-3.0",
		io,
		unrepresentable: "any",
	}) as SchemaObject;
}
