import { defineConfig } from "tsup";

export default defineConfig([
	// Para bundlers (npm): ESM + CJS + tipos.
	{
		entry: ["src/index.ts"],
		format: ["esm", "cjs"],
		dts: true,
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
