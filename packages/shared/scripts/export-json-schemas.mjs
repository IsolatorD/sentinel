// Escribe los JSON Schema de la ingesta en los tests del SDK de Python.
//   pnpm --filter @sentinel/shared export:schemas   (necesita `pnpm build` antes)
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ingestJsonSchemas } from "../dist/json-schemas.js";

const dir = fileURLToPath(
	new URL("../../sdk-python/tests/schemas/", import.meta.url),
);
mkdirSync(dir, { recursive: true });
for (const [file, schema] of Object.entries(ingestJsonSchemas())) {
	writeFileSync(`${dir}${file}`, `${JSON.stringify(schema, null, "\t")}\n`);
	console.log(`escrito ${file}`);
}
