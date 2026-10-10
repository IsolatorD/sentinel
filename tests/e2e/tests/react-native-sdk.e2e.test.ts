import { SentinelClient } from "@sentinel/react-native";
import {
	createdApiTokenDtoSchema,
	eventDetailDtoSchema,
} from "@sentinel/shared";
import { transformSync } from "esbuild";
import { afterEach, describe, expect, it } from "vitest";
import { eventually } from "../support/eventually.js";
import { createTenant } from "../support/factories.js";

// El SDK de React Native real enviando a la API real; el worker simboliza con el source map subido.
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
function build() {
	const out = transformSync(SOURCE, {
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

const clients: SentinelClient[] = [];
afterEach(async () => {
	await Promise.all(clients.splice(0).map((c) => c.close()));
	delete (globalThis as Record<string, unknown>).ErrorUtils;
});

describe("SDK de React Native contra la API real", () => {
	it("un error de la app llega con su stack de Hermes y se simboliza con el source map del bundle", async () => {
		const t = await createTenant();
		const { map, lineno, colno } = build();

		// El build de la app sube su mapa: `index.android.bundle.map` se guarda como `~/index.android.bundle`.
		const token = createdApiTokenDtoSchema.parse(
			(
				await t.client.post(
					`/api/organizations/${t.orgId}/tokens`,
					{ name: "ci" },
					t.owner,
				)
			).json,
		).token;
		const upload = await t.client.putBinary(
			`${t.projectPath}/releases/2.0.0/artifacts?name=${encodeURIComponent("~/index.android.bundle")}`,
			map,
			{ headers: { Authorization: `Bearer ${token}` } },
		);
		expect(upload.status).toBe(201);

		// Una app React Native: el manejador global de errores que instala el SDK.
		let handler: (error: unknown, isFatal?: boolean) => void = () => {};
		(globalThis as Record<string, unknown>).ErrorUtils = {
			getGlobalHandler: () => handler,
			setGlobalHandler: (h: typeof handler) => {
				handler = h;
			},
		};
		const sdk = new SentinelClient(
			{ dsn: t.dsn, release: "2.0.0", environment: "e2e", breadcrumbs: false },
			{ reactNative: { Platform: { OS: "android", Version: 34 } } },
		).install();
		clients.push(sdk);

		const error = new Error("sin items");
		// Lo que produce Hermes en un teléfono: la ruta del bundle en el dispositivo y la posición del build.
		error.stack = [
			"Error: sin items",
			`    at computeTotal (address at /data/user/0/com.shop/files/index.android.bundle:${lineno}:${colno})`,
			`    at anonymous (address at /data/user/0/com.shop/files/index.android.bundle:${lineno}:${colno + 400})`,
		].join("\n");
		handler(error, false);
		await sdk.flush();

		await eventually(async () => {
			const issues = (
				await t.client.get(`${t.projectPath}/issues?status=all`, t.owner)
			).json.items as Array<{ id: string }>;
			expect(issues).toHaveLength(1);
		});
		const [issue] = (
			await t.client.get(`${t.projectPath}/issues?status=all`, t.owner)
		).json.items as Array<{ id: string; culprit: string | null }>;
		const detail = (
			await t.client.get(`${t.projectPath}/issues/${issue.id}`, t.owner)
		).json;
		const event = eventDetailDtoSchema.parse(detail.latestEvent);
		expect(event).toMatchObject({ platform: "react-native", release: "2.0.0" });

		const frames = (
			event.payload as {
				exception: {
					values: Array<{
						stacktrace: { frames: Array<Record<string, unknown>> };
					}>;
				};
			}
		).exception.values[0].stacktrace.frames;
		// El último frame es donde se lanzó.
		const symbolicated = frames.filter((f) => f.symbolicated).at(-1);
		expect(symbolicated).toMatchObject({
			filename: "src/cart.ts",
			in_app: true,
			// El nombre minificado se reemplaza por el original.
			function: "computeTotal",
		});
		expect(issue.culprit).toContain("cart.ts");
	});
});
