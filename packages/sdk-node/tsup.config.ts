import { defineConfig } from "tsup";

export default defineConfig({
	entry: ["src/index.ts"],
	format: ["esm", "cjs"],
	// Los tipos de `@sentinel/core` van dentro: el paquete se instala solo, sin `core` publicado.
	dts: { resolve: [/^@sentinel\//] },
	platform: "node",
	target: "node20",
	sourcemap: true,
	outExtension: ({ format }) => ({ js: format === "cjs" ? ".cjs" : ".js" }),
});
