import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parseCommand } from "./args.js";
import { run } from "./cli.js";
import { artifactNameFor, findSourceMaps } from "./files.js";

const MAP = JSON.stringify({ version: 3, sources: ["a.ts"], mappings: "AAAA" });
const ENV = {
	SENTINEL_URL: "https://sentinel.example.com/",
	SENTINEL_AUTH_TOKEN: "snt_x",
	SENTINEL_ORG: "org1",
	SENTINEL_PROJECT: "proj1",
	SENTINEL_RELEASE: "1.2.3",
};

async function buildDir(files: Record<string, string>) {
	const dir = await mkdtemp(join(tmpdir(), "sentinel-cli-"));
	for (const [rel, content] of Object.entries(files)) {
		const full = join(dir, rel);
		await mkdir(join(full, ".."), { recursive: true });
		await writeFile(full, content);
	}
	return dir;
}

describe("parseCommand", () => {
	it("toma la configuración de las variables de entorno", () => {
		const cmd = parseCommand(["sourcemaps", "upload", "./dist"], ENV);
		expect(cmd).toMatchObject({
			kind: "upload",
			options: {
				directory: "./dist",
				release: "1.2.3",
				// Se quita la barra final: se concatena una ruta absoluta después.
				url: "https://sentinel.example.com",
				token: "snt_x",
				org: "org1",
				project: "proj1",
				urlPrefix: "~/",
				dryRun: false,
			},
		});
	});

	it("las opciones tienen prioridad sobre el entorno", () => {
		const cmd = parseCommand(
			[
				"sourcemaps",
				"upload",
				"d",
				"-r",
				"9.9.9",
				"--project",
				"p2",
				"--dry-run",
				"--url-prefix",
				"~/static",
			],
			ENV,
		);
		expect(cmd).toMatchObject({
			kind: "upload",
			options: {
				release: "9.9.9",
				project: "p2",
				dryRun: true,
				urlPrefix: "~/static",
			},
		});
	});

	it("lista lo que falta", () => {
		const cmd = parseCommand(["sourcemaps", "upload", "d"], {});
		expect(cmd.kind).toBe("error");
		if (cmd.kind === "error") {
			for (const v of [
				"SENTINEL_RELEASE",
				"SENTINEL_URL",
				"SENTINEL_AUTH_TOKEN",
				"SENTINEL_ORG",
				"SENTINEL_PROJECT",
			]) {
				expect(cmd.message).toContain(v);
			}
		}
	});

	it("rechaza comandos, argumentos y URLs inválidos; la ayuda no exige nada", () => {
		expect(parseCommand(["deploy"], ENV).kind).toBe("error");
		expect(parseCommand(["sourcemaps", "upload"], ENV).kind).toBe("error");
		expect(parseCommand(["sourcemaps", "upload", "a", "b"], ENV).kind).toBe(
			"error",
		);
		expect(
			parseCommand(["sourcemaps", "upload", "d", "--nope"], ENV).kind,
		).toBe("error");
		expect(
			parseCommand(["sourcemaps", "upload", "d", "--url", "nada"], ENV).kind,
		).toBe("error");
		expect(
			parseCommand(["sourcemaps", "upload", "d", "--url", "ftp://x.com"], ENV)
				.kind,
		).toBe("error");
		expect(parseCommand([], {}).kind).toBe("help");
		expect(parseCommand(["--help"], {}).kind).toBe("help");
	});
});

describe("nombres de los archivos", () => {
	it("coinciden con los que el worker busca", () => {
		expect(
			artifactNameFor("/b/dist", "/b/dist/assets/app.3f2a.js.map", "~/"),
		).toBe("~/assets/app.3f2a.js");
		expect(artifactNameFor("/b/dist", "/b/dist/main.js.map", "~/static")).toBe(
			"~/static/main.js",
		);
		expect(
			artifactNameFor(
				"/b/dist",
				"/b/dist/a/b.js.map",
				"https://cdn.example.com/v2/",
			),
		).toBe("~/v2/a/b.js");
	});

	it("encuentra los .map, ignora node_modules y descarta lo inválido", async () => {
		const dir = await buildDir({
			"assets/app.js.map": MAP,
			"assets/app.js": "console.log(1)",
			"vendor.js.map": MAP,
			"node_modules/x/y.js.map": MAP,
			"rota.js.map": "no es json",
			"otra.js.map": JSON.stringify({ hola: 1 }),
			"vacia.js.map": "",
		});
		const { files, skipped } = await findSourceMaps(dir, "~/");
		expect(files.map((f) => f.name)).toEqual([
			"~/assets/app.js",
			"~/vendor.js",
		]);
		expect(skipped.map((s) => s.reason).sort()).toEqual([
			"empty file",
			"not a source map",
			"not valid JSON",
		]);
	});

	it("falla con un directorio que no existe", async () => {
		await expect(findSourceMaps("/no/existe/nunca", "~/")).rejects.toThrow(
			"not a directory",
		);
	});
});

describe("sourcemaps upload", () => {
	let server: Server;
	let url: string;
	let received: { path: string; auth?: string; type?: string; body: string }[];
	let respond: (req: IncomingMessage) => { status: number; body?: unknown };

	beforeEach(async () => {
		received = [];
		respond = () => ({ status: 201, body: {} });
		server = createServer((req, res) => {
			const chunks: Buffer[] = [];
			req.on("data", (c) => chunks.push(c));
			req.on("end", () => {
				received.push({
					path: `${req.method} ${req.url}`,
					auth: req.headers.authorization,
					type: req.headers["content-type"],
					body: Buffer.concat(chunks).toString(),
				});
				const { status, body } = respond(req);
				res.writeHead(status, { "content-type": "application/json" });
				res.end(JSON.stringify(body ?? {}));
			});
		});
		await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
		url = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
	});
	afterEach(() => new Promise<void>((r) => server.close(() => r())));

	const exec = async (argv: string[], env: Record<string, string> = {}) => {
		const out: string[] = [];
		const err: string[] = [];
		const code = await run(
			argv,
			{ ...ENV, SENTINEL_URL: url, ...env },
			{ out: (l) => out.push(l), err: (l) => err.push(l) },
			async () => {},
		);
		return { code, out: out.join("\n"), err: err.join("\n") };
	};

	it("sube cada mapa a la ruta de la release con el token y el cuerpo intactos", async () => {
		const dir = await buildDir({
			"assets/app.js.map": MAP,
			"main.js.map": MAP,
		});
		const result = await exec(["sourcemaps", "upload", dir]);

		expect(result.code).toBe(0);
		expect(result.out).toContain("Done. 2 file(s) uploaded.");
		expect(received.map((r) => r.path).sort()).toEqual([
			"PUT /api/organizations/org1/projects/proj1/releases/1.2.3/artifacts?name=~%2Fassets%2Fapp.js",
			"PUT /api/organizations/org1/projects/proj1/releases/1.2.3/artifacts?name=~%2Fmain.js",
		]);
		for (const r of received) {
			expect(r).toMatchObject({
				auth: "Bearer snt_x",
				type: "application/octet-stream",
				body: MAP,
			});
		}
	});

	it("codifica la versión de la release en la ruta", async () => {
		const dir = await buildDir({ "a.js.map": MAP });
		await exec(["sourcemaps", "upload", dir, "--release", "web@1.0.0+build 7"]);
		expect(received[0].path).toContain(
			"/releases/web%401.0.0%2Bbuild%207/artifacts",
		);
	});

	it("--dry-run no envía nada", async () => {
		const dir = await buildDir({ "a.js.map": MAP });
		const result = await exec(["sourcemaps", "upload", dir, "--dry-run"]);
		expect(result.code).toBe(0);
		expect(result.out).toContain("~/a.js");
		expect(received).toHaveLength(0);
	});

	it("un error 4xx no se reintenta y deja código 1 con el mensaje del servidor", async () => {
		respond = () => ({ status: 401, body: { message: "Invalid token" } });
		const dir = await buildDir({ "a.js.map": MAP });
		const result = await exec(["sourcemaps", "upload", dir]);
		expect(result.code).toBe(1);
		expect(result.out).toContain("401 Invalid token");
		expect(result.err).toContain("1 of 1 file(s) failed");
		expect(received).toHaveLength(1);
	});

	it("reintenta los 5xx y se recupera", async () => {
		let calls = 0;
		respond = () => (++calls < 3 ? { status: 503 } : { status: 201 });
		const dir = await buildDir({ "a.js.map": MAP });
		const result = await exec(["sourcemaps", "upload", dir]);
		expect(result.code).toBe(0);
		expect(received).toHaveLength(3);
	});

	it("se rinde tras 3 intentos fallidos", async () => {
		respond = () => ({ status: 500 });
		const dir = await buildDir({ "a.js.map": MAP });
		const result = await exec(["sourcemaps", "upload", dir]);
		expect(result.code).toBe(1);
		expect(received).toHaveLength(3);
	});

	it("un servidor caído da error sin colgarse", async () => {
		const dir = await buildDir({ "a.js.map": MAP });
		const result = await exec(["sourcemaps", "upload", dir], {
			SENTINEL_URL: "http://127.0.0.1:1",
		});
		expect(result.code).toBe(1);
	});

	it("sin mapas en el directorio falla con un aviso claro", async () => {
		const dir = await buildDir({ "app.js": "x" });
		const result = await exec(["sourcemaps", "upload", dir]);
		expect(result.code).toBe(1);
		expect(result.err).toContain("no source maps");
	});

	it("errores de uso devuelven 2 y muestran la ayuda", async () => {
		const result = await exec(["sourcemaps", "upload"]);
		expect(result.code).toBe(2);
		expect(result.err).toContain("Usage:");
	});
});
