import { describe, expect, it } from "vitest";
import {
	httpSnippet,
	npmSnippet,
	reactSnippet,
	scriptTagSnippet,
} from "./installSnippets";

describe("install snippets", () => {
	const dsn = "http://key@localhost:3000/abc";
	it("incluyen la DSN en el código de configuración", () => {
		expect(npmSnippet({ dsn }).code).toContain(`dsn: "${dsn}"`);
		expect(npmSnippet({ dsn }).install).toBe("npm install @sentinel/browser");
		expect(scriptTagSnippet({ dsn })).toContain(`dsn: "${dsn}"`);
		expect(
			scriptTagSnippet({ dsn, release: "9.9.9", environment: "staging" }),
		).toContain('release: "9.9.9"');
	});

	it("React usa @sentinel/react con el ErrorBoundary", () => {
		const snippet = reactSnippet({ dsn });
		expect(snippet.install).toBe("npm install @sentinel/react");
		expect(snippet.code).toContain(`dsn: "${dsn}"`);
		expect(snippet.code).toContain("Sentinel.ErrorBoundary");
	});

	it("sin SDK se envía a la API con la clave y el proyecto de la DSN", () => {
		const curl = httpSnippet({ dsn: "https://pk123@sentinel.dev/proj-1" });
		expect(curl).toContain('"https://sentinel.dev/api/proj-1/events"');
		expect(curl).toContain("X-Sentinel-Key: pk123");
	});

	it("con una DSN vacía deja una plantilla", () => {
		expect(httpSnippet({ dsn: "" })).toContain("<projectId>");
	});
});
