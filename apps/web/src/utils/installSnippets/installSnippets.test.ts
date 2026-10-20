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
		expect(npmSnippet({ dsn }).install).toBe(
			"npm install @argus-isolator/browser",
		);
		expect(scriptTagSnippet({ dsn })).toContain(`dsn: "${dsn}"`);
		expect(
			scriptTagSnippet({ dsn, release: "9.9.9", environment: "staging" }),
		).toContain('release: "9.9.9"');
	});

	it("React usa @argus-isolator/react con el ErrorBoundary", () => {
		const snippet = reactSnippet({ dsn });
		expect(snippet.install).toBe(
			"npm install @argus-isolator/browser @argus-isolator/react",
		);
		expect(snippet.code).toContain(`dsn: "${dsn}"`);
		expect(snippet.code).toContain("Sentinel.ErrorBoundary");
	});

	it("Node usa @argus-isolator/node con tracesSampleRate y cierra al apagar", () => {
		const snippet = nodeSnippet({ dsn });
		expect(snippet.install).toBe("npm install @argus-isolator/node");
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

	it("React Native usa @argus-isolator/react-native e indica cómo subir los source maps", () => {
		const snippet = reactNativeSnippet({ dsn, release: "2.1.0" });
		expect(snippet.install).toBe("npm install @argus-isolator/react-native");
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

	describe("instalación", () => {
		const remote = "https://abc123@3-19-1-21.sslip.io/proj-1";
		const base = "https://3-19-1-21.sslip.io/sdk";

		it("deduce el origen de la instancia de la DSN, salvo en local", () => {
			expect(sdkOrigin(remote)).toBe("https://3-19-1-21.sslip.io");
			expect(sdkOrigin("http://key@localhost:3000/abc")).toBeNull();
			expect(sdkOrigin("http://key@127.0.0.1:3000/abc")).toBeNull();
			expect(sdkOrigin("no-es-una-url")).toBeNull();
		});

		it("las SDK de JavaScript se instalan desde npm, con o sin instancia remota", () => {
			for (const dsn of [remote, "http://key@localhost:3000/abc"]) {
				expect(npmSnippet({ dsn }).install).toBe(
					"npm install @argus-isolator/browser",
				);
				expect(nodeSnippet({ dsn }).install).toBe(
					"npm install @argus-isolator/node",
				);
				expect(reactNativeSnippet({ dsn }).install).toBe(
					"npm install @argus-isolator/react-native",
				);
				expect(reactSnippet({ dsn }).install).toBe(
					"npm install @argus-isolator/browser @argus-isolator/react",
				);
			}
		});

		it("Python y la etiqueta <script> salen de la propia instancia", () => {
			expect(pythonSnippet({ dsn: remote }).install).toBe(
				`pip install ${base}/sentinel-sdk.tar.gz`,
			);
			expect(scriptTagSnippet({ dsn: remote })).toContain(
				`<script src="${base}/sentinel.min.js"></script>`,
			);
			// En local no hay quien sirva el archivo: se usa el nombre del paquete.
			expect(
				pythonSnippet({ dsn: "http://key@localhost:3000/a" }).install,
			).toBe("pip install sentinel-sdk");
		});

		it("la CLI de source maps también se instala desde npm", () => {
			expect(reactNativeSnippet({ dsn: remote }).code).toContain(
				"npm install -g @argus-isolator/cli",
			);
		});
	});
});
