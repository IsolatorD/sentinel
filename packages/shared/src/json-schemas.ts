import { z } from "zod";
import { ingestEventSchema } from "./ingest.js";
import { ingestTransactionSchema } from "./transactions.js";

/**
 * Los contratos de ingesta como JSON Schema, para que los SDK escritos en otros lenguajes (Python...)
 * validen en sus tests lo que envían contra el mismo esquema que usa el servidor.
 */
export function ingestJsonSchemas() {
	const options = { io: "input", unrepresentable: "any" } as const;
	return {
		"event.schema.json": z.toJSONSchema(ingestEventSchema, options),
		"transaction.schema.json": z.toJSONSchema(ingestTransactionSchema, options),
	};
}
