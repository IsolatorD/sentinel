import { describe, expect, it } from "vitest";
import { sourceMapsUploadSnippet } from "./cli-snippets";

describe("sourceMapsUploadSnippet", () => {
	const input = {
		apiUrl: "https://sentinel.example.com",
		orgId: "org_1",
		projectId: "proj-1",
		release: "1.4.0",
	};

	it("incluye los ids y la release, y deja el token como marcador", () => {
		const snippet = sourceMapsUploadSnippet(input);
		expect(snippet).toContain("SENTINEL_ORG='org_1'");
		expect(snippet).toContain("SENTINEL_PROJECT='proj-1'");
		expect(snippet).toContain("--release '1.4.0'");
		expect(snippet).toContain("SENTINEL_AUTH_TOKEN=<your-api-token>");
	});

	it("escapa comillas para que una versión rara no rompa el comando", () => {
		const snippet = sourceMapsUploadSnippet({ ...input, release: "it's" });
		expect(snippet).toContain(`--release 'it'\\''s'`);
	});
});
