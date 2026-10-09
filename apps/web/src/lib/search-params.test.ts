import { describe, expect, it } from "vitest";
import {
	issuesSearchInputSchema,
	omitDefaults,
	resolveIssueSearch,
	resolveIssuesSearch,
} from "./search-params";

describe("resolveIssuesSearch", () => {
	it("aplica los valores por defecto cuando la URL no trae nada", () => {
		expect(resolveIssuesSearch({})).toEqual({
			status: "unresolved",
			q: undefined,
			level: undefined,
			sort: "lastSeen",
			order: "desc",
			page: 1,
		});
		expect(resolveIssuesSearch(undefined).page).toBe(1);
	});

	it("respeta los valores válidos, convirtiendo la página desde texto", () => {
		expect(
			resolveIssuesSearch({
				status: "resolved",
				q: " timeout ",
				sort: "events",
				order: "asc",
				page: "3",
				level: "warning",
			}),
		).toMatchObject({
			status: "resolved",
			q: "timeout",
			sort: "events",
			order: "asc",
			page: 3,
			level: "warning",
		});
	});

	it("una URL manipulada nunca rompe la pantalla: lo inválido cae al valor por defecto", () => {
		const bad = resolveIssuesSearch({
			status: "borrado",
			sort: "nombre",
			order: "azar",
			page: "-4",
			level: "critico",
			q: "   ",
		});
		expect(bad).toMatchObject({
			status: "unresolved",
			sort: "lastSeen",
			order: "desc",
			page: 1,
		});
		expect(bad.q).toBeUndefined();
		expect(bad.level).toBeUndefined();
		expect(resolveIssuesSearch({ page: "abc" }).page).toBe(1);
	});

	it("el esquema de entrada es todo opcional (los enlaces no tienen que indicar nada)", () => {
		expect(issuesSearchInputSchema.parse({})).toEqual({});
	});
});

describe("resolveIssueSearch", () => {
	it("pestaña por defecto y evento solo si es un UUID", () => {
		expect(resolveIssueSearch({})).toEqual({
			event: undefined,
			tab: "details",
		});
		expect(resolveIssueSearch({ tab: "events" }).tab).toBe("events");
		expect(resolveIssueSearch({ tab: "otra" }).tab).toBe("details");
		expect(resolveIssueSearch({ event: "no-es-uuid" }).event).toBeUndefined();
		expect(
			resolveIssueSearch({ event: "44444444-4444-4444-8444-444444444444" })
				.event,
		).toBe("44444444-4444-4444-8444-444444444444");
	});
});

describe("omitDefaults", () => {
	it("quita lo que vale lo mismo que el default y lo indefinido, para mantener la URL corta", () => {
		expect(
			omitDefaults(
				{ status: "unresolved", sort: "events", q: undefined, page: 1 },
				{ status: "unresolved", page: 1 },
			),
		).toEqual({ sort: "events" });
	});
});
