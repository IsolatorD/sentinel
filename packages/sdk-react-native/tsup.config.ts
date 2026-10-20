import { defineConfig } from "tsup";

export default defineConfig({
	entry: ["src/index.ts"],
	format: ["esm", "cjs"],
	// Los tipos de `@sentinel/core` van dentro: el paquete se instala solo, sin `core` publicado.
	dts: { resolve: [/^@sentinel\//] },
	target: "es2020",
	sourcemap: true,
	// `react` y `react-native` los pone la app; `@sentinel/core` se empaqueta dentro.
	external: ["react", "react-native"],
	outExtension: ({ format }) => ({ js: format === "cjs" ? ".cjs" : ".js" }),
});
