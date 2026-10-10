import http from "node:http";
import type { AddressInfo } from "node:net";
import { ingestEventSchema, ingestTransactionSchema } from "@sentinel/shared";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as Sentinel from "./index";

const KEY = "0123456789abcdef0123456789abcdef";
const PROJECT = "48140d16-1ad4-4a8b-b08e-04762f0d78b9";
const DSN = `https://${KEY}@sentinel.example.com/${PROJECT}`;
type Body = Record<string, unknown>;

let bodies: Body[] = [];
const servers: http.Server[] = [];

beforeEach(() => {
	bodies = [];
});
afterEach(async () => {
	await Sentinel.close();
	for (const s of servers.splice(0)) await new Promise((r) => s.close(r));
	vi.restoreAllMocks();
});

function init(options: Partial<Sentinel.RNOptions> = {}) {
	const fetchImpl = vi.fn(async (_url: string, init: { body: string }) => {
		bodies.push(JSON.parse(init.body));
		return new Response(null, { status: 202 });
	});
	return Sentinel.init(
		{ dsn: DSN, breadcrumbs: false, captureGlobalErrors: false, ...options },
		{ fetchImpl: fetchImpl as unknown as typeof fetch },
	);
}

const transactions = () => bodies.filter((b) => "trace_id" in b);
const events = () => bodies.filter((b) => !("trace_id" in b));

/** Un servidor con CORS abierto (el XHR de jsdom lo exige) que guarda las cabeceras recibidas. */
async function server(status = 200) {
	const received: Array<Record<string, string | string[] | undefined>> = [];
	const srv = http.createServer((req, res) => {
		res.setHeader("access-control-allow-origin", "*");
		res.setHeader("access-control-allow-headers", "traceparent");
		if (req.method === "OPTIONS") return res.writeHead(204).end();
		received.push(req.headers);
		res.statusCode = status;
		res.end("ok");
	});
	servers.push(srv);
	await new Promise<void>((r) => srv.listen(0, "127.0.0.1", r));
	return {
		url: `http://127.0.0.1:${(srv.address() as AddressInfo).port}`,
		received,
	};
}

function xhr(url: string) {
	return new Promise<number>((resolve, reject) => {
		const req = new XMLHttpRequest();
		req.open("GET", url);
		req.onloadend = () =>
			req.status ? resolve(req.status) : reject(new Error("network error"));
		req.send();
	});
}

describe("red (XMLHttpRequest, que es lo que usan fetch y axios en React Native)", () => {
	it("cada petición dentro de una transacción es un span, sin la query, con su estado", async () => {
		const target = await server(503);
		const client = init({ tracesSampleRate: 1, tracing: { appStart: false } });
		const tx = Sentinel.startTransaction({
			name: "Checkout",
			op: "navigation",
		});
		await xhr(`${target.url}/pay?token=secret`);
		tx?.finish();
		await client.flush();

		const [payload] = transactions();
		expect(ingestTransactionSchema.safeParse(payload).success).toBe(true);
		const [span] = payload.spans as Array<Record<string, unknown>>;
		expect(span).toMatchObject({
			op: "http.client",
			description: `GET ${target.url}/pay`,
			status: "internal_error",
			data: { "http.status_code": 503 },
		});
		expect(JSON.stringify(payload)).not.toContain("secret");
	});

	it("traceparent solo se envía a las URLs de tracePropagationTargets", async () => {
		const target = await server();
		const other = await server();
		const client = init({
			tracesSampleRate: 1,
			tracing: { appStart: false },
			tracePropagationTargets: [target.url],
		});
		const tx = Sentinel.startTransaction({ name: "t" });
		await xhr(`${target.url}/a`);
		await xhr(`${other.url}/b`);
		tx?.finish();
		await client.flush();
		expect(target.received[0].traceparent).toMatch(
			new RegExp(`^00-${tx?.traceId}-[0-9a-f]{16}-01$`),
		);
		expect(other.received[0].traceparent).toBeUndefined();
	});

	it("las peticiones del propio SDK no generan spans", async () => {
		const client = init({ tracesSampleRate: 1, tracing: { appStart: false } });
		const tx = Sentinel.startTransaction({ name: "t" });
		const req = new XMLHttpRequest();
		req.open("POST", `https://sentinel.example.com/api/${PROJECT}/events`);
		req.send("{}");
		req.abort();
		tx?.finish();
		await client.flush();
		expect(tx?.spans).toHaveLength(0);
	});

	it("las peticiones dejan breadcrumbs en los errores", async () => {
		const target = await server();
		const client = init({ breadcrumbs: { http: true, console: false } });
		await xhr(`${target.url}/items`);
		Sentinel.captureMessage("after");
		await client.flush();
		const crumb = (
			events()[0].breadcrumbs as Array<{
				category: string;
				data: Record<string, unknown>;
			}>
		)[0];
		expect(crumb.category).toBe("xhr");
		expect(crumb.data).toMatchObject({
			method: "GET",
			status_code: 200,
			url: `${target.url}/items`,
		});
	});
});

describe("API pública", () => {
	it("sin init todo funciona y no envía nada", async () => {
		expect(Sentinel.captureException(new Error("x"))).toBeUndefined();
		expect(Sentinel.startTransaction({ name: "t" })).toBeUndefined();
		expect(Sentinel.trace("op", "d", () => 7)).toBe(7);
		await expect(Sentinel.trace("op", "d", async () => "ok")).resolves.toBe(
			"ok",
		);
		expect(await Sentinel.flush()).toBe(true);
	});

	it("una DSN inválida desactiva el SDK sin lanzar", () => {
		const client = Sentinel.init({ dsn: "nope" });
		expect(client.enabled).toBe(false);
		expect(Sentinel.captureMessage("x")).toBeUndefined();
	});
});

describe("ErrorBoundary y Profiler", () => {
	function Bomb(): never {
		throw new Error("render failed");
	}

	it("atrapa el error de render, lo envía con su pila de componentes y muestra el fallback", async () => {
		vi.spyOn(console, "error").mockImplementation(() => {});
		const client = init();
		render(
			<Sentinel.ErrorBoundary fallback={<p>Algo salió mal</p>}>
				<main>
					<Bomb />
				</main>
			</Sentinel.ErrorBoundary>,
		);
		expect(screen.getByText("Algo salió mal")).toBeInTheDocument();
		await client.flush();
		const [event] = events();
		expect(ingestEventSchema.safeParse(event).success).toBe(true);
		expect(event.tags).toMatchObject({
			handled: "true",
			mechanism: "react.error_boundary",
		});
		expect(
			(event.contexts as { react: { componentStack: string } }).react
				.componentStack,
		).toContain("Bomb");
	});

	it("el fallback como función recibe el error y resetError vuelve a mostrar los hijos", async () => {
		vi.spyOn(console, "error").mockImplementation(() => {});
		init();
		let broken = true;
		function Maybe() {
			if (broken) throw new Error("once");
			return <p>recuperado</p>;
		}
		render(
			<Sentinel.ErrorBoundary
				fallback={({ error, resetError }) => (
					<button
						type="button"
						onClick={() => {
							broken = false;
							resetError();
						}}
					>
						{(error as Error).message}
					</button>
				)}
			>
				<Maybe />
			</Sentinel.ErrorBoundary>,
		);
		screen.getByRole("button", { name: "once" }).click();
		expect(await screen.findByText("recuperado")).toBeInTheDocument();
	});

	it("un beforeCapture que lanza no impide el fallback", () => {
		vi.spyOn(console, "error").mockImplementation(() => {});
		init();
		render(
			<Sentinel.ErrorBoundary
				fallback={<p>fallback</p>}
				beforeCapture={() => {
					throw new Error("bad hook");
				}}
			>
				<Bomb />
			</Sentinel.ErrorBoundary>,
		);
		expect(screen.getByText("fallback")).toBeInTheDocument();
	});

	it("Profiler registra el montaje como span de la transacción en curso", async () => {
		const client = init({ tracesSampleRate: 1, tracing: { appStart: false } });
		const tx = Sentinel.startTransaction({ name: "Cart", op: "navigation" });
		render(
			<Sentinel.Profiler name="CartScreen">
				<p>carrito</p>
			</Sentinel.Profiler>,
		);
		tx?.finish();
		await client.flush();
		expect(
			(transactions()[0].spans as Array<Record<string, unknown>>)[0],
		).toMatchObject({
			op: "ui.react.mount",
			description: "<CartScreen>",
		});
	});
});
