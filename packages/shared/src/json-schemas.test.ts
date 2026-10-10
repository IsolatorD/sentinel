import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ingestJsonSchemas } from "./json-schemas.js";

const schemasDir = fileURLToPath(
	new URL("../../sdk-python/tests/schemas/", import.meta.url),
);

describe("JSON Schema de la ingesta (para el SDK de Python)", () => {
	for (const [file, schema] of Object.entries(ingestJsonSchemas())) {
		it(`${file} está al día con los esquemas Zod`, () => {
			const committed = JSON.parse(
				readFileSync(`${schemasDir}${file}`, "utf8"),
			);
			// Si falla: pnpm --filter @sentinel/shared export:schemas
			expect(committed).toEqual(JSON.parse(JSON.stringify(schema)));
		});
	}

	it("describen los campos que los SDK deben respetar", () => {
		const { "event.schema.json": event, "transaction.schema.json": tx } =
			ingestJsonSchemas() as Record<
				string,
				{ properties: Record<string, unknown>; required?: string[] }
			>;
		expect(Object.keys(event.properties)).toEqual(
			expect.arrayContaining(["exception", "breadcrumbs", "contexts"]),
		);
		expect(tx.required).toEqual(
			expect.arrayContaining(["trace_id", "span_id", "name", "duration_ms"]),
		);
	});
});
