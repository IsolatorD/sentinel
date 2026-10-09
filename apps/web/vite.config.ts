import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// La API a la que apunta el proxy de desarrollo (por defecto, la local).
const apiTarget = process.env.VITE_API_TARGET ?? "http://localhost:3000";

export default defineConfig({
	plugins: [react(), tailwindcss()],
	resolve: {
		alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
	},
	server: {
		port: Number(process.env.VITE_PORT ?? 5173),
		proxy: { "/api": apiTarget },
	},
});
