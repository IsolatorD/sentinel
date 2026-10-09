import {
	apiTokenListDtoSchema,
	artifactDtoSchema,
	artifactListDtoSchema,
	createdApiTokenDtoSchema,
	releaseListDtoSchema,
} from "@sentinel/shared";
import { transformSync } from "esbuild";
import { describe, expect, it } from "vitest";
import { eventually } from "../support/eventually.js";
import { createTenant, type Tenant } from "../support/factories.js";

const SOURCE = `export function run(cart: { items?: number[] }) {
	function computeTotal(c: { items?: number[] }) {
		if (!c.items) {
			throw new Error("sin items");
		}
		return c.items.length;
	}
	return computeTotal(cart);
}
`;

/** Minifica de verdad: el mapa es el que produciría un build real. */
function build(source = SOURCE) {
	const out = transformSync(source, {
		loader: "ts",
		minify: true,
		sourcemap: "external",
		sourcefile: "../src/cart.ts",
	});
	const lines = out.code.split("\n");
	const line = lines.findIndex((l) => l.includes("new Error"));
	return {
		map: out.map,
		lineno: line + 1,
		colno: lines[line].indexOf("new Error") + 1,
	};
}

const artifactsPath = (t: Tenant, version = "1.0.0") =>
	`${t.projectPath}/releases/${version}/artifacts`;
const orgTokens = (t: Tenant) => `/api/organizations/${t.orgId}/tokens`;

async function createToken(t: Tenant, name = "ci") {
	const res = await t.client.post(orgTokens(t), { name }, t.owner);
	expect(res.status).toBe(201);
	return createdApiTokenDtoSchema.parse(res.json);
}

const bearer = (token: string) => ({
	headers: { Authorization: `Bearer ${token}` },
});

const upload = (
	t: Tenant,
	token: string,
	body: string,
	name = "~/assets/app.js",
	version = "1.0.0",
) =>
	t.client.putBinary(
		`${artifactsPath(t, version)}?name=${encodeURIComponent(name)}`,
		body,
		bearer(token),
	);

describe("tokens de API", () => {
	it("el valor completo se ve una sola vez; la lista solo muestra el prefijo", async () => {
		const t = await createTenant();
		const created = await createToken(t, "github-actions");
		expect(created.token).toMatch(/^snt_[0-9a-f]{48}$/);
		expect(created.token.startsWith(created.prefix)).toBe(true);

		const list = await t.client.get(orgTokens(t), t.owner);
		expect(list.status).toBe(200);
		const tokens = apiTokenListDtoSchema.parse(list.json);
		expect(tokens).toHaveLength(1);
		expect(tokens[0]).toMatchObject({ id: created.id, name: "github-actions" });
		expect(list.text).not.toContain(created.token);
	});

	it("exige nombre, y solo owner/admin los gestionan", async () => {
		const t = await createTenant();
		expect(
			(await t.client.post(orgTokens(t), { name: " " }, t.owner)).status,
		).toBe(400);

		const member = await t.client.signUp("member");
		await t.client.addMember(t.owner, t.orgId, member, "member");
		const outsider = await t.client.signUp("outsider");

		expect((await t.client.get(orgTokens(t), member)).status).toBe(403);
		expect(
			(await t.client.post(orgTokens(t), { name: "x" }, member)).status,
		).toBe(403);
		expect((await t.client.get(orgTokens(t), outsider)).status).toBe(404);
		expect((await t.client.get(orgTokens(t))).status).toBe(401);
	});

	it("un token revocado deja de funcionar", async () => {
		const t = await createTenant();
		const created = await createToken(t);
		const map = build().map;
		expect((await upload(t, created.token, map)).status).toBe(201);

		const revoke = await t.client.delete(
			`${orgTokens(t)}/${created.id}`,
			t.owner,
		);
		expect(revoke.status).toBe(204);
		expect((await upload(t, created.token, map)).status).toBe(401);
	});

	it("registra cuándo se usó por última vez", async () => {
		const t = await createTenant();
		const created = await createToken(t);
		expect(created.lastUsedAt).toBeNull();
		await upload(t, created.token, build().map);
		await eventually(async () => {
			const [token] = apiTokenListDtoSchema.parse(
				(await t.client.get(orgTokens(t), t.owner)).json,
			);
			expect(token.lastUsedAt).not.toBeNull();
		});
	});
});

describe("subida de source maps", () => {
	it("con un token de API: queda guardado, listado y contado en la release", async () => {
		const t = await createTenant();
		const { token } = await createToken(t);
		const { map } = build();

		const res = await upload(
			t,
			token,
			map,
			"https://app.example.com/assets/app.3f2a.js?v=1#x",
		);
		expect(res.status).toBe(201);
		const artifact = artifactDtoSchema.parse(res.json);
		// El nombre se normaliza: sin origen, query ni hash.
		expect(artifact.name).toBe("~/assets/app.3f2a.js");
		expect(artifact.size).toBe(Buffer.byteLength(map));

		const list = await t.client.get(artifactsPath(t), t.owner);
		expect(artifactListDtoSchema.parse(list.json).map((a) => a.name)).toEqual([
			"~/assets/app.3f2a.js",
		]);

		const releases = releaseListDtoSchema.parse(
			(await t.client.get(`${t.projectPath}/releases`, t.owner)).json,
		);
		expect(releases.find((r) => r.version === "1.0.0")?.artifactCount).toBe(1);
	});

	it("subir el mismo archivo otra vez lo reemplaza, no lo duplica", async () => {
		const t = await createTenant();
		const { token } = await createToken(t);
		await upload(t, token, build().map);
		const second = await upload(t, token, build(`${SOURCE}// cambio\n`).map);
		expect(second.status).toBe(201);
		const list = artifactListDtoSchema.parse(
			(await t.client.get(artifactsPath(t), t.owner)).json,
		);
		expect(list).toHaveLength(1);
		expect(list[0].id).toBe(artifactDtoSchema.parse(second.json).id);
	});

	it("también la puede subir un owner/admin con su sesión, pero no un member", async () => {
		const t = await createTenant();
		const member = await t.client.signUp("member");
		await t.client.addMember(t.owner, t.orgId, member, "member");
		const path = `${artifactsPath(t)}?name=~/a.js`;
		const map = build().map;

		expect(
			(await t.client.putBinary(path, map, { session: t.owner })).status,
		).toBe(201);
		expect(
			(await t.client.putBinary(path, map, { session: member })).status,
		).toBe(403);
	});

	it("rechaza lo que no es un source map", async () => {
		const t = await createTenant();
		const { token } = await createToken(t);
		const put = (body: string, query = "?name=~/a.js") =>
			t.client.putBinary(`${artifactsPath(t)}${query}`, body, bearer(token));

		expect((await put(build().map, "")).status).toBe(400); // falta name
		expect((await put("")).status).toBe(400); // vacío
		expect((await put("esto no es json")).status).toBe(400);
		expect((await put(JSON.stringify({ hola: "mundo" }))).status).toBe(400);
		expect(
			(await put(JSON.stringify({ version: 2, sources: [], mappings: "" })))
				.status,
		).toBe(400);
	});

	it("sin credenciales o con un token inválido: 401, y el tipo binario no sirve en otras rutas", async () => {
		const t = await createTenant();
		const path = `${artifactsPath(t)}?name=~/a.js`;
		const map = build().map;

		expect((await t.client.putBinary(path, map)).status).toBe(401);
		expect(
			(await t.client.putBinary(path, map, bearer("snt_".padEnd(52, "0"))))
				.status,
		).toBe(401);
		expect((await t.client.putBinary(path, map, bearer("basura"))).status).toBe(
			401,
		);

		// El cuerpo binario de 25 MB no se acepta en el resto de la API, ni con credenciales.
		const other = await t.client.putBinary(`${t.projectPath}/issues`, "x", {
			session: t.owner,
		});
		expect(other.status).toBe(415);
		const ingest = await t.client.request(`/api/${t.projectId}/events`, {
			method: "POST",
			origin: null,
			binary: Buffer.from("x"),
			headers: {
				"Content-Type": "application/octet-stream",
				"X-Sentinel-Key": t.key,
			},
		});
		expect(ingest.status).toBe(415);
	});

	it("un token de otra organización no puede subir al proyecto ajeno", async () => {
		const a = await createTenant();
		const b = await createTenant();
		const foreign = await createToken(b);
		const res = await upload(a, foreign.token, build().map);
		expect(res.status).toBe(404);
		expect(
			artifactListDtoSchema.parse(
				(await a.client.get(artifactsPath(a), a.owner)).json,
			),
		).toEqual([]);

		// Ni listar ni borrar archivos ajenos con la sesión de otra organización.
		const own = await createToken(a);
		const created = artifactDtoSchema.parse(
			(await upload(a, own.token, build().map)).json,
		);
		expect((await b.client.get(artifactsPath(a), b.owner)).status).toBe(404);
		expect(
			(await b.client.delete(`${artifactsPath(a)}/${created.id}`, b.owner))
				.status,
		).toBe(404);
	});

	it("borrar: owner/admin sí, member no; un id inexistente da 404", async () => {
		const t = await createTenant();
		const { token } = await createToken(t);
		const created = artifactDtoSchema.parse(
			(await upload(t, token, build().map)).json,
		);
		const member = await t.client.signUp("member");
		await t.client.addMember(t.owner, t.orgId, member, "member");

		expect(
			(await t.client.delete(`${artifactsPath(t)}/${created.id}`, member))
				.status,
		).toBe(403);
		expect(
			(await t.client.delete(`${artifactsPath(t)}/${created.id}`, t.owner))
				.status,
		).toBe(204);
		expect(
			(await t.client.delete(`${artifactsPath(t)}/${created.id}`, t.owner))
				.status,
		).toBe(404);
		expect(
			artifactListDtoSchema.parse(
				(await t.client.get(artifactsPath(t), t.owner)).json,
			),
		).toEqual([]);
	});

	it("borrar la release se lleva sus archivos", async () => {
		const t = await createTenant();
		const { token } = await createToken(t);
		await upload(t, token, build().map);
		expect(
			(await t.client.delete(`${t.projectPath}/releases/1.0.0`, t.owner))
				.status,
		).toBe(204);
		expect((await t.client.get(artifactsPath(t), t.owner)).json).toEqual([]);
	});
});

describe("simbolización de punta a punta", () => {
	const minifiedEvent = (
		b: ReturnType<typeof build>,
		over: { release?: string; file?: string } = {},
	) => ({
		level: "error",
		release: over.release ?? "1.0.0",
		environment: "prod",
		exception: {
			values: [
				{
					type: "Error",
					value: "sin items",
					stacktrace: {
						frames: [
							{
								filename: over.file ?? "https://app.example.com/assets/app.js",
								function: "r",
								lineno: b.lineno,
								colno: b.colno,
								in_app: true,
							},
						],
					},
				},
			],
		},
	});

	const frameOf = async (t: Tenant) => {
		const issues = (
			await t.client.get(`${t.projectPath}/issues?status=all`, t.owner)
		).json;
		const issue = issues.items[0];
		const events = (
			await t.client.get(`${t.projectPath}/issues/${issue.id}/events`, t.owner)
		).json;
		const detail = (
			await t.client.get(
				`${t.projectPath}/issues/${issue.id}/events/${events.items[0].id}`,
				t.owner,
			)
		).json;
		return {
			issue,
			frame: detail.payload.exception.values[0].stacktrace.frames[0],
		};
	};

	it("el stacktrace guardado apunta al código original, con función y contexto", async () => {
		const t = await createTenant();
		const { token } = await createToken(t);
		const b = build();
		expect((await upload(t, token, b.map, "~/assets/app.js")).status).toBe(201);

		await t.client.ingest(t.projectId, t.key, minifiedEvent(b));
		await eventually(async () =>
			expect((await frameOf(t)).frame.symbolicated).toBe(true),
		);

		const { issue, frame } = await frameOf(t);
		expect(frame).toMatchObject({
			filename: "src/cart.ts",
			function: "computeTotal",
			lineno: 4,
			abs_path: "https://app.example.com/assets/app.js",
			in_app: true,
			context_line: '\t\t\tthrow new Error("sin items");',
		});
		expect(frame.pre_context).toContain("\t\tif (!c.items) {");
		expect(frame.post_context[0]).toBe("\t\t}");
		// El título y el culprit del issue salen del código original, no del minificado.
		expect(issue.culprit).toContain("computeTotal");
	});

	it("el mismo error en dos builds (archivos distintos) se agrupa en un solo issue", async () => {
		const t = await createTenant();
		const { token } = await createToken(t);
		const first = build();
		const second = build(`// una línea más\n${SOURCE}`);
		await upload(t, token, first.map, "~/assets/app.aaa.js", "1.0.0");
		await upload(t, token, second.map, "~/assets/app.bbb.js", "1.1.0");

		await t.client.ingest(
			t.projectId,
			t.key,
			minifiedEvent(first, { file: "https://x.com/assets/app.aaa.js" }),
		);
		await t.client.ingest(
			t.projectId,
			t.key,
			minifiedEvent(second, {
				release: "1.1.0",
				file: "https://x.com/assets/app.bbb.js",
			}),
		);

		await eventually(async () => {
			const { items } = (
				await t.client.get(`${t.projectPath}/issues?status=all`, t.owner)
			).json;
			expect(items).toHaveLength(1);
			expect(items[0].eventCount).toBe(2);
		});
	});

	it("un evento de una release sin mapas se guarda tal cual, sin fallar", async () => {
		const t = await createTenant();
		const b = build();
		await t.client.ingest(
			t.projectId,
			t.key,
			minifiedEvent(b, { release: "9.9.9" }),
		);
		await eventually(async () =>
			expect((await frameOf(t)).issue).toBeDefined(),
		);
		const { frame } = await frameOf(t);
		expect(frame).toMatchObject({
			filename: "https://app.example.com/assets/app.js",
			function: "r",
		});
		expect(frame.symbolicated).toBeUndefined();
	});

	it("un mapa de otro proyecto no se usa", async () => {
		const a = await createTenant();
		const b = await createTenant();
		const { token } = await createToken(b);
		const built = build();
		await upload(b, token, built.map, "~/assets/app.js");

		await a.client.ingest(a.projectId, a.key, minifiedEvent(built));
		await eventually(async () =>
			expect((await frameOf(a)).issue).toBeDefined(),
		);
		expect((await frameOf(a)).frame.symbolicated).toBeUndefined();
	});
});
