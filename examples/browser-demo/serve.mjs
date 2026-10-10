// Servidor estático mínimo para la demo: node examples/browser-demo/serve.mjs [puerto]
import { createReadStream, existsSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const port = Number(process.argv[2] ?? 5500);

const files = {
	"/": [join(here, "index.html"), "text/html; charset=utf-8"],
	"/demo.js": [join(here, "demo.js"), "text/javascript; charset=utf-8"],
	"/sentinel.js": [
		join(here, "../../packages/sdk-browser/dist/sentinel.min.js"),
		"text/javascript; charset=utf-8",
	],
};

createServer((req, res) => {
	const path = (req.url ?? "/").split("?")[0];
	// Cualquier otra ruta (/checkout, /health...) devuelve la página: sirve para probar navegación.
	const [file, type] =
		files[path] ?? (path === "/health" ? [null, null] : files["/"]);
	if (path === "/slow") {
		// Respuesta lenta a propósito, para ver un span largo en la cascada.
		const ms = Math.min(
			Number(new URL(req.url, "http://x").searchParams.get("ms")) || 800,
			5000,
		);
		setTimeout(
			() =>
				res
					.writeHead(200, { "content-type": "application/json" })
					.end('{"slow":true}'),
			ms,
		);
		return;
	}
	if (path === "/health") {
		res
			.writeHead(200, { "content-type": "application/json" })
			.end('{"ok":true}');
		return;
	}
	if (!file || !existsSync(file)) {
		res
			.writeHead(404)
			.end(
				"not found (¿compilaste el SDK? pnpm --filter @sentinel/browser build)",
			);
		return;
	}
	res.writeHead(200, { "content-type": type });
	createReadStream(file).pipe(res);
}).listen(port, () => console.log(`demo en http://localhost:${port}`));
