import { describe, expect, it } from "vitest";
import { ticketDescription, ticketSummary } from "./ticket-description.js";

const issue = {
	title: "TypeError: Cannot read properties of undefined",
	culprit: "computeTotal (cart.ts:42)",
	level: "error",
	eventCount: 7,
	firstSeen: new Date("2026-10-01T10:00:00.000Z"),
	lastSeen: new Date("2026-10-09T12:00:00.000Z"),
	lastRelease: "2.4.0",
};

describe("ticketSummary", () => {
	it("deja el título en una línea y dentro del límite de Jira", () => {
		expect(ticketSummary("a\n  b\tc")).toBe("a b c");
		expect(ticketSummary("x".repeat(400)).length).toBeLessThanOrEqual(250);
	});
});

describe("ticketDescription", () => {
	const url = "https://sentinel.test/acme/projects/app/issues/1";
	const doc = ticketDescription(issue, url);
	const dump = JSON.stringify(doc);

	it("es un documento ADF válido en su forma", () => {
		expect(doc).toMatchObject({ type: "doc", version: 1 });
		expect(doc.content.length).toBeGreaterThan(2);
	});

	it("incluye lo esencial y un enlace de vuelta a Sentinel", () => {
		for (const part of [
			issue.title,
			"computeTotal (cart.ts:42)",
			"Level: error",
			"Events: 7",
			"Release: 2.4.0",
		])
			expect(dump).toContain(part);
		expect(dump).toContain(`"href":"${url}"`);
	});

	it("omite lo que no hay", () => {
		const bare = JSON.stringify(
			ticketDescription({ ...issue, culprit: null, lastRelease: null }, url),
		);
		expect(bare).not.toContain("Where:");
		expect(bare).not.toContain("Release:");
	});
});
