// Demo de source maps de punta a punta, contra una API local:
//   pnpm build && pnpm seed:demo && node examples/sourcemaps-demo/run.mjs [--api http://localhost:3000]
// 1) minifica un pequeño "checkout" (esbuild)  2) crea un token de API  3) sube el mapa con la CLI
// 4) envía un error ocurrido en el bundle minificado  5) muestra dónde verlo.
// Solo para desarrollo local: usa el usuario de la demo.
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const argv = process.argv.slice(2);
const API = argv[argv.indexOf("--api") + 1] || "http://localhost:3000";
const WEB = "http://localhost:5173";
const RELEASE = `demo-${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "")}`;
const root = (p) => fileURLToPath(new URL(`../../${p}`, import.meta.url));
const { build } = createRequire(root("tests/e2e/package.json"))("esbuild");

const cookies = new Map();
async function call(path, { method = "GET", body, headers = {} } = {}) {
	const res = await fetch(`${API}${path}`, {
		method,
		headers: {
			Origin: WEB,
			...(body ? { "Content-Type": "application/json" } : {}),
			...(cookies.size && {
				Cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join("; "),
			}),
			...headers,
		},
		body: body ? JSON.stringify(body) : undefined,
	});
	for (const line of res.headers.getSetCookie()) {
		const [pair] = line.split(";");
		const i = pair.indexOf("=");
		cookies.set(pair.slice(0, i), pair.slice(i + 1));
	}
	const text = await res.text();
	if (res.status >= 400)
		throw new Error(`${method} ${path}: ${res.status} ${text}`);
	return text ? JSON.parse(text) : undefined;
}

const SOURCE = `
export function checkout(cart) {
	function computeTotal(items) {
		// Bug a propósito: el carrito puede llegar sin productos.
		return items.reduce((sum, item) => sum + item.price * item.qty, 0);
	}
	return computeTotal(cart.items);
}
checkout({});
`;

// ---------- 1) minificar ----------
const dist = await mkdtemp(join(tmpdir(), "sentinel-demo-"));
await mkdir(join(dist, "assets"));
const result = await build({
	stdin: { contents: SOURCE, sourcefile: "src/checkout.ts", loader: "ts" },
	outfile: join(dist, "assets/app.js"),
	bundle: true,
	minify: true,
	sourcemap: "external",
	sourcesContent: true,
	write: false,
});
for (const file of result.outputFiles)
	await writeFile(file.path, file.contents);
const code = result.outputFiles.find((f) => f.path.endsWith("app.js")).text;
console.log(`Bundle minificado (${code.length} bytes):\n  ${code.trim()}\n`);

// ---------- 2) token ----------
await call("/api/auth/sign-in/email", {
	method: "POST",
	body: { email: "demo@sentinel.dev", password: "demo-password-123" },
});
const [org] = await call("/api/auth/organization/list");
const [project] = await call(`/api/organizations/${org.id}/projects`);
const detail = await call(
	`/api/organizations/${org.id}/projects/${project.id}`,
);
const key = detail.keys.find((k) => k.isActive);
const created = await call(`/api/organizations/${org.id}/tokens`, {
	method: "POST",
	body: { name: `demo ${RELEASE}` },
});

// ---------- 3) subir con la CLI ----------
const { stdout } = await promisify(execFile)(
	process.execPath,
	[root("packages/cli/dist/bin.js"), "sourcemaps", "upload", dist],
	{
		env: {
			PATH: process.env.PATH,
			SENTINEL_URL: API,
			SENTINEL_AUTH_TOKEN: created.token,
			SENTINEL_ORG: org.id,
			SENTINEL_PROJECT: project.id,
			SENTINEL_RELEASE: RELEASE,
		},
	},
);
console.log(stdout);

// ---------- 4) un error ocurrido en el bundle minificado ----------
const lines = code.split("\n");
const lineIndex = lines.findIndex((l) => l.includes("reduce"));
const colno = lines[lineIndex].indexOf("reduce") + 1;
await call(`/api/${project.id}/events`, {
	method: "POST",
	headers: { "X-Sentinel-Key": key.publicKey },
	body: {
		level: "error",
		release: RELEASE,
		environment: "production",
		platform: "javascript",
		exception: {
			values: [
				{
					type: "TypeError",
					value: "Cannot read properties of undefined (reading 'reduce')",
					stacktrace: {
						frames: [
							{
								filename: "https://shop.example.com/assets/app.js",
								function: "r",
								lineno: lineIndex + 1,
								colno,
								in_app: true,
							},
						],
					},
				},
			],
		},
	},
});

console.log(`Listo. Release ${RELEASE}. Abre el issue en:`);
console.log(
	`  ${WEB}/${org.slug}/projects/${project.slug}/issues?release=${RELEASE}`,
);
console.log(`Y los archivos subidos en:`);
console.log(`  ${WEB}/${org.slug}/projects/${project.slug}/releases`);
