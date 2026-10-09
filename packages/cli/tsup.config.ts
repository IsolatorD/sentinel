import { defineConfig } from "tsup";

export default defineConfig({
	entry: { bin: "src/bin.ts", index: "src/index.ts" },
	format: ["esm"],
	target: "node20",
	dts: { entry: { index: "src/index.ts" } },
	// La CLI se instala sola en el CI: lleva dentro lo poco que usa de shared (sin zod).
	noExternal: [/^@sentinel\//],
});
