import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		include: ["tests/**/*.e2e.test.ts"],
		globalSetup: ["./global-setup.ts"],
		testTimeout: 30_000,
		hookTimeout: 120_000,
		// Los archivos comparten el mismo servidor (y sus límites de ritmo): en serie.
		fileParallelism: false,
	},
});
