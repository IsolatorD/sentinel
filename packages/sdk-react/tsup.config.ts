import { defineConfig } from "tsup";

export default defineConfig({
	entry: ["src/index.ts"],
	format: ["esm", "cjs"],
	dts: true,
	target: "es2018",
	sourcemap: true,
	external: ["react", "@sentinel/browser"],
	outExtension: ({ format }) => ({ js: format === "cjs" ? ".cjs" : ".js" }),
});
