import { describe, expect, it } from "vitest";
import { en } from "./locales/en";
import { es } from "./locales/es";

type Tree = { [key: string]: string | Tree };

function flatten(
	tree: Tree,
	prefix = "",
	out: Record<string, string> = {},
): Record<string, string> {
	for (const [key, value] of Object.entries(tree)) {
		const path = prefix ? `${prefix}.${key}` : key;
		if (typeof value === "string") out[path] = value;
		else flatten(value, path, out);
	}
	return out;
}

const english = flatten(en as unknown as Tree);
const spanish = flatten(es as unknown as Tree);
const placeholders = (text: string) =>
	[...text.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort();

describe("traducciones", () => {
	it("el español tiene exactamente las mismas claves que el inglés", () => {
		expect(Object.keys(spanish).sort()).toEqual(Object.keys(english).sort());
	});

	it("ningún texto está vacío", () => {
		for (const [key, value] of [
			...Object.entries(english),
			...Object.entries(spanish),
		]) {
			expect(value.trim(), key).not.toBe("");
		}
	});

	it("las variables {{...}} coinciden entre idiomas", () => {
		for (const key of Object.keys(english)) {
			expect(placeholders(spanish[key]), key).toEqual(
				placeholders(english[key]),
			);
		}
	});

	it("el español usa tuteo neutro (sin voseo)", () => {
		const voseo =
			/\b(tenés|querés|Iniciá|Creá|Intentá|Instalá|Agregá|Probá|Usá|Evitá|escribí)\b/;
		for (const [key, value] of Object.entries(spanish))
			expect(value, key).not.toMatch(voseo);
	});
});
