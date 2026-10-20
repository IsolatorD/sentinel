import { describe, expect, it } from "vitest";
import {
	httpSnippet,
	nodeSnippet,
	npmSnippet,
	pythonSnippet,
	reactNativeSnippet,
	reactSnippet,
	scriptTagSnippet,
	sdkOrigin,
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
		expect(snippet.install).toBe(
			"npm install @sentinel/browser @sentinel/react",
		);
		expect(snippet.code).toContain(`dsn: "${dsn}"`);
		expect(snippet.code).toContain("Sentinel.ErrorBoundary");
	});

	it("Node usa @sentinel/node con tracesSampleRate y cierra al apagar", () => {
		const snippet = nodeSnippet({ dsn });
		expect(snippet.install).toBe("npm install @sentinel/node");
		expect(snippet.code).toContain(`dsn: "${dsn}"`);
		expect(snippet.code).toContain("tracesSampleRate");
		expect(snippet.code).toContain("Sentinel.close()");
	});

	it("Python usa sentinel-sdk con los middlewares ASGI y WSGI", () => {
		const snippet = pythonSnippet({ dsn });
		expect(snippet.install).toBe("pip install sentinel-sdk");
		expect(snippet.code).toContain(`"${dsn}"`);
		expect(snippet.code).toContain("SentinelAsgiMiddleware");
		expect(snippet.code).toContain("setup_flask");
		expect(snippet.code).toContain("traces_sample_rate");
	});

	it("React Native usa @sentinel/react-native e indica cómo subir los source maps", () => {
		const snippet = reactNativeSnippet({ dsn, release: "2.1.0" });
		expect(snippet.install).toBe("npm install @sentinel/react-native");
		expect(snippet.code).toContain(`dsn: "${dsn}"`);
		expect(snippet.code).toContain("instrumentNavigation");
		expect(snippet.code).toContain(
			"sentinel-cli sourcemaps upload ./build --release 2.1.0",
		);
	});

	it("sin SDK se envía a la API con la clave y el proyecto de la DSN", () => {
		const curl = httpSnippet({ dsn: "https://pk123@sentinel.dev/proj-1" });
		expect(curl).toContain('"https://sentinel.dev/api/proj-1/events"');
		expect(curl).toContain("X-Sentinel-Key: pk123");
	});

	it("con una DSN vacía deja una plantilla", () => {
		expect(httpSnippet({ dsn: "" })).toContain("<projectId>");
	});

	describe("instalación desde la propia instancia", () => {
		const remote = "https://abc123@3-19-1-21.sslip.io/proj-1";
		const base = "https://3-19-1-21.sslip.io/sdk";

		it("deduce el origen de las SDK de la DSN, salvo en local", () => {
			expect(sdkOrigin(remote)).toBe("https://3-19-1-21.sslip.io");
			expect(sdkOrigin("http://key@localhost:3000/abc")).toBeNull();
			expect(sdkOrigin("http://key@127.0.0.1:3000/abc")).toBeNull();
			expect(sdkOrigin("no-es-una-url")).toBeNull();
		});

		it("cada plataforma instala desde /sdk/ de esa instancia", () => {
			const dsn = remote;
			expect(npmSnippet({ dsn }).install).toBe(
				`npm install ${base}/sentinel-browser.tgz`,
			);
			expect(nodeSnippet({ dsn }).install).toBe(
				`npm install ${base}/sentinel-node.tgz`,
			);
			expect(reactNativeSnippet({ dsn }).install).toBe(
				`npm install ${base}/sentinel-react-native.tgz`,
			);
			expect(pythonSnippet({ dsn }).install).toBe(
				`pip install ${base}/sentinel-sdk.tar.gz`,
			);
			expect(scriptTagSnippet({ dsn })).toContain(
				`<script src="${base}/sentinel.min.js"></script>`,
			);
		});

		it("React instala el SDK del navegador junto al suyo (es su dependencia de pares)", () => {
			expect(reactSnippet({ dsn: remote }).install).toBe(
				`npm install ${base}/sentinel-browser.tgz ${base}/sentinel-react.tgz`,
			);
		});
	});
});
