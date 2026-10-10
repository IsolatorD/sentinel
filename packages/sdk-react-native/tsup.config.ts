import { defineConfig } from "tsup";

export default defineConfig({
	entry: ["src/index.ts"],
	format: ["esm", "cjs"],
	dts: true,
	target: "es2020",
	sourcemap: true,
	// `react` y `react-native` los pone la app; `@sentinel/core` se empaqueta dentro.
	external: ["react", "react-native"],
	outExtension: ({ format }) => ({ js: format === "cjs" ? ".cjs" : ".js" }),
});
