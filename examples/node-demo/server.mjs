// Backend de demostración con el SDK de Node.
//   node examples/node-demo/server.mjs --dsn <dsn> [--port 5601]
// Pruébalo con la demo del navegador (examples/browser-demo): su botón "Llamar al backend Node" hace una
// petición aquí con la cabecera `traceparent`, y las dos transacciones salen unidas en la misma traza.
import { createServer } from "node:http";
import * as Sentinel from "../../packages/sdk-node/dist/index.js";

const argv = process.argv.slice(2);
const args = Object.fromEntries(
	argv.flatMap((a, i) =>
		a.startsWith("--") ? [[a.slice(2), argv[i + 1]]] : [],
	),
);
const port = Number(args.port ?? 5601);
const dsn = args.dsn;
if (!dsn) {
	console.error("Falta --dsn <la DSN de tu proyecto>.");
	process.exit(1);
}

Sentinel.init({
	dsn,
	release: "node-demo@1.0.0",
	environment: "demo",
	tracesSampleRate: 1,
	debug: true,
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const json = (res, status, body) => {
	res
		.writeHead(status, { "content-type": "application/json" })
		.end(JSON.stringify(body));
};

// Simula el trabajo de un backend: cada paso aparece como un span en la cascada.
async function findOrder(id) {
	return Sentinel.trace(
		"db.query",
		"select * from orders where id = ?",
		async () => {
			await sleep(60 + Math.random() * 60);
			if (id === "0") throw new Error("pedido 0 no existe en la base de datos");
			return { id, total: 99.9 };
		},
	);
}

const server = createServer(async (req, res) => {
	// CORS abierto solo para la demo; `traceparent` debe estar permitido para que el navegador lo envíe.
	res.setHeader("access-control-allow-origin", "*");
	res.setHeader("access-control-allow-headers", "traceparent, content-type");
	if (req.method === "OPTIONS") return res.writeHead(204).end();

	const url = new URL(req.url ?? "/", "http://localhost");
	try {
		const order = /^\/api\/orders\/(\w+)$/.exec(url.pathname);
		if (order) {
			const found = await findOrder(order[1]);
			await Sentinel.trace("cache.set", "guardar en caché", () => sleep(15));
			return json(res, 200, found);
		}
		if (url.pathname === "/api/slow") {
			await Sentinel.trace("work", "cálculo pesado", () => sleep(800));
			return json(res, 200, { slow: true });
		}
		json(res, 404, { error: "no encontrado" });
	} catch (error) {
		// El error se captura dentro de la petición: queda enlazado a su traza.
		Sentinel.captureException(error);
		json(res, 500, { error: "error interno" });
	}
});

server.listen(port, () =>
	console.log(`backend de demo en http://localhost:${port}`),
);

for (const signal of ["SIGINT", "SIGTERM"]) {
	process.on(signal, async () => {
		await Sentinel.close();
		process.exit(0);
	});
}
