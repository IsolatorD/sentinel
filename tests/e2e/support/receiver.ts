import { createServer, type IncomingHttpHeaders, type Server } from "node:http";

export interface ReceivedRequest {
	method?: string;
	url?: string;
	headers: IncomingHttpHeaders;
	raw: string;
	// biome-ignore lint/suspicious/noExplicitAny: cuerpo JSON arbitrario que cada prueba inspecciona
	json: any;
}

/** Servidor HTTP local que hace de destino de un webhook y anota lo que recibe. */
export async function startReceiver() {
	const requests: ReceivedRequest[] = [];
	// Estado con el que responde; cada prueba lo ajusta.
	const behavior = { status: 200, failFirst: 0 };
	let seen = 0;

	const server: Server = createServer((req, res) => {
		const chunks: Buffer[] = [];
		req.on("data", (c) => chunks.push(c));
		req.on("end", () => {
			const raw = Buffer.concat(chunks).toString();
			let json: unknown;
			try {
				json = JSON.parse(raw);
			} catch {
				json = undefined;
			}
			requests.push({
				method: req.method,
				url: req.url,
				headers: req.headers,
				raw,
				json,
			});
			seen++;
			const status = seen <= behavior.failFirst ? 500 : behavior.status;
			res.writeHead(status);
			res.end("ok");
		});
	});
	await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
	const port = (server.address() as { port: number }).port;
	return {
		url: `http://127.0.0.1:${port}/hook`,
		requests,
		behavior,
		close: () => new Promise<void>((r) => server.close(() => r())),
	};
}

export type Receiver = Awaited<ReturnType<typeof startReceiver>>;
