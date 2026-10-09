import {
	listIssueEventsQuerySchema,
	listIssuesQuerySchema,
	updateIssueSchema,
} from "@sentinel/shared";
import { describe, expect, it } from "vitest";

describe("listIssuesQuerySchema", () => {
	it("aplica valores por defecto: no resueltos, más recientes primero, 25 por página", () => {
		expect(listIssuesQuerySchema.parse({})).toEqual({
			status: "unresolved",
			sort: "lastSeen",
			order: "desc",
			limit: 25,
			offset: 0,
		});
	});

	it("convierte los strings de la query a números", () => {
		const q = listIssuesQuerySchema.parse({
			limit: "10",
			offset: "20",
			q: "  timeout  ",
		});
		expect(q).toMatchObject({ limit: 10, offset: 20, q: "timeout" });
	});

	it("acepta status=all y los orden permitidos", () => {
		expect(
			listIssuesQuerySchema.parse({
				status: "all",
				sort: "events",
				order: "asc",
			}),
		).toMatchObject({
			status: "all",
			sort: "events",
			order: "asc",
		});
	});

	it("rechaza valores fuera de rango o desconocidos", () => {
		const bad = [
			{ limit: "0" },
			{ limit: "101" },
			{ limit: "abc" },
			{ offset: "-1" },
			{ status: "borrado" },
			{ sort: "nombre" },
			{ order: "random" },
			{ level: "critico" },
			{ q: "   " },
		];
		for (const input of bad) {
			expect(
				listIssuesQuerySchema.safeParse(input).success,
				JSON.stringify(input),
			).toBe(false);
		}
	});
});

describe("otros esquemas", () => {
	it("los eventos de un issue solo paginan", () => {
		expect(listIssueEventsQuerySchema.parse({ limit: "5" })).toEqual({
			limit: 5,
			offset: 0,
		});
	});

	it("updateIssueSchema exige un estado válido", () => {
		expect(updateIssueSchema.parse({ status: "resolved" })).toEqual({
			status: "resolved",
		});
		expect(updateIssueSchema.safeParse({}).success).toBe(false);
		expect(updateIssueSchema.safeParse({ status: "all" }).success).toBe(false);
	});
});
