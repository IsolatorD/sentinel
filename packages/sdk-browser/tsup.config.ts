import { defineConfig } from "tsup";

export default defineConfig([
	// Para bundlers (npm): ESM + CJS + tipos.
	{
		entry: ["src/index.ts"],
		format: ["esm", "cjs"],
		// Los tipos de `@sentinel/core` van dentro: el paquete se instala solo, sin `core` publicado.
		dts: { resolve: [/^@sentinel\//] },
		target: "es2018",
		sourcemap: true,
		outExtension: ({ format }) => ({ js: format === "cjs" ? ".cjs" : ".js" }),
	},
	// Para <script src="...">: global `Sentinel`, minificado.
	{
		entry: { sentinel: "src/index.ts" },
		format: ["iife"],
		globalName: "Sentinel",
		target: "es2018",
		minify: true,
		outExtension: () => ({ js: ".min.js" }),
	},
]);
