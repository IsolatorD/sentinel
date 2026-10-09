import { describe, expect, it } from "vitest";
import { eventPayload } from "@/test/fixtures";
import { contextEntries, parseEventPayload } from "@/utils/eventView/eventView";

describe("parseEventPayload", () => {
	it("interpreta un payload válido y conserva los datos del cliente", () => {
		const view = parseEventPayload(
			eventPayload as unknown as Record<string, unknown>,
		);
		expect(view?.exception?.values).toHaveLength(2);
		expect(view?.user?.id).toBe("user_103");
		expect(view?._client?.ip).toBe("127.0.0.1");
	});

	it("devuelve null si el payload no cumple el formato (la pantalla muestra el JSON crudo)", () => {
		expect(
			parseEventPayload({ level: "nope", exception: { values: [] } }),
		).toBeNull();
	});
});

describe("contextEntries", () => {
	it("convierte un contexto en pares clave-valor legibles", () => {
		expect(
			contextEntries(
				{ browser: { name: "Chrome", viewport: { width: 1 } } },
				"browser",
			),
		).toEqual([
			["name", "Chrome"],
			["viewport", '{"width":1}'],
		]);
		expect(contextEntries(undefined, "browser")).toEqual([]);
		expect(contextEntries({}, "os")).toEqual([]);
	});
});
