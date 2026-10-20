import type { SnippetOptions } from "@/utils/installSnippets/installSnippetsInterface";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * Desde dónde instalar las SDK: la propia instancia las sirve en `/sdk/` (ver `scripts/pack-sdks.sh`),
 * y su dirección sale de la DSN. En local (localhost) no las sirve nadie: se usan los nombres de paquete.
 */
export function sdkOrigin(dsn: string): string | null {
	try {
		const url = new URL(dsn);
		return LOCAL_HOSTS.has(url.hostname) ? null : url.origin;
	} catch {
		return null;
	}
}

const sdkFile = (dsn: string, file: string, fallback: string) => {
	const origin = sdkOrigin(dsn);
	return origin ? `${origin}/sdk/${file}` : fallback;
};

/** Instalación con un bundler (npm). */
export function npmSnippet({
	dsn,
	release = "1.0.0",
	environment = "production",
}: SnippetOptions) {
	return {
		install: `npm install ${sdkFile(dsn, "sentinel-browser.tgz", "@argus-isolator/browser")}`,
		code: [
			'import * as Sentinel from "@argus-isolator/browser";',
			"",
			"Sentinel.init({",
			`  dsn: "${dsn}",`,
			`  release: "${release}",`,
			`  environment: "${environment}",`,
			"});",
		].join("\n"),
	};
}

/** Instalación con una etiqueta <script>. */
export function scriptTagSnippet({
	dsn,
	release = "1.0.0",
	environment = "production",
}: SnippetOptions) {
	return [
		`<script src="${sdkFile(dsn, "sentinel.min.js", "https://your-cdn.example.com/sentinel.min.js")}"></script>`,
		"<script>",
		"  Sentinel.init({",
		`    dsn: "${dsn}",`,
		`    release: "${release}",`,
		`    environment: "${environment}",`,
		"  });",
		"</script>",
	].join("\n");
}

/** Instalación en React Native: errores de JavaScript, arranque de la app, pantallas y red. */
export function reactNativeSnippet({
	dsn,
	release = "1.0.0",
	environment = "production",
}: SnippetOptions) {
	return {
		install: `npm install ${sdkFile(dsn, "sentinel-react-native.tgz", "@argus-isolator/react-native")}`,
		code: [
			'import * as Sentinel from "@argus-isolator/react-native";',
			"",
			"// Lo primero de index.js, antes de registrar la app.",
			"Sentinel.init({",
			`  dsn: "${dsn}",`,
			`  release: "${release}",`,
			`  environment: "${environment}",`,
			"  tracesSampleRate: 1,",
			"});",
			"",
			"// Pantallas (React Navigation):",
			"// <NavigationContainer ref={navigationRef}",
			"//   onReady={() => Sentinel.instrumentNavigation(navigationRef)}>",
			"",
			"// Errores de render: Sentinel.withErrorBoundary(App, { fallback: <Oops /> })",
			"",
			"// Para ver el código original en cada error, sube los source maps de tu build:",
			`//   npm install -g ${sdkFile(dsn, "sentinel-cli.tgz", "@argus-isolator/cli")}`,
			`//   sentinel-cli sourcemaps upload ./build --release ${release}`,
		].join("\n"),
	};
}

/** Instalación en Python: captura errores y mide cada petición de ASGI/WSGI (FastAPI, Flask, Django...). */
export function pythonSnippet({
	dsn,
	release = "1.0.0",
	environment = "production",
}: SnippetOptions) {
	return {
		install: `pip install ${sdkFile(dsn, "sentinel-sdk.tar.gz", "sentinel-sdk")}`,
		code: [
			"import sentinel_sdk",
			"",
			"# Antes de crear la aplicación: captura los errores sin controlar y mide el rendimiento.",
			"sentinel_sdk.init(",
			`    "${dsn}",`,
			`    release="${release}",`,
			`    environment="${environment}",`,
			"    traces_sample_rate=1.0,",
			")",
			"",
			"# FastAPI / Starlette (ASGI):",
			"app = sentinel_sdk.SentinelAsgiMiddleware(app)",
			"",
			"# Flask: sentinel_sdk.setup_flask(app)",
			"# Django: añade SentinelDjangoMiddleware a MIDDLEWARE y envuelve la aplicación WSGI",
			"# Cualquier otra aplicación WSGI: sentinel_sdk.SentinelWsgiMiddleware(app)",
		].join("\n"),
	};
}

/** Instalación en Node.js: captura errores del proceso y mide cada petición que atiende el servidor. */
export function nodeSnippet({
	dsn,
	release = "1.0.0",
	environment = "production",
}: SnippetOptions) {
	return {
		install: `npm install ${sdkFile(dsn, "sentinel-node.tgz", "@argus-isolator/node")}`,
		code: [
			'import * as Sentinel from "@argus-isolator/node";',
			"",
			"// Antes de crear el servidor: así se miden también sus peticiones.",
			"Sentinel.init({",
			`  dsn: "${dsn}",`,
			`  release: "${release}",`,
			`  environment: "${environment}",`,
			"  tracesSampleRate: 1,",
			"});",
			"",
			"// Al apagar el servidor, envía lo pendiente:",
			'process.on("SIGTERM", async () => {',
			"  await Sentinel.close();",
			"  process.exit(0);",
			"});",
		].join("\n"),
	};
}

/** Instalación en React: `@argus-isolator/react` reexporta el SDK del navegador y añade el ErrorBoundary. */
export function reactSnippet({
	dsn,
	release = "1.0.0",
	environment = "production",
}: SnippetOptions) {
	return {
		// `@argus-isolator/react` necesita el SDK del navegador (dependencia de pares): se instalan juntos.
		install: `npm install ${sdkFile(dsn, "sentinel-browser.tgz", "@argus-isolator/browser")} ${sdkFile(dsn, "sentinel-react.tgz", "@argus-isolator/react")}`,
		code: [
			'import * as Sentinel from "@argus-isolator/react";',
			'import { createRoot } from "react-dom/client";',
			"",
			"Sentinel.init({",
			`  dsn: "${dsn}",`,
			`  release: "${release}",`,
			`  environment: "${environment}",`,
			"});",
			"",
			'createRoot(document.getElementById("root")!, Sentinel.reactRootOptions()).render(',
			"  <Sentinel.ErrorBoundary fallback={<p>Something went wrong.</p>}>",
			"    <App />",
			"  </Sentinel.ErrorBoundary>,",
			");",
		].join("\n"),
	};
}

/**
 * Para las plataformas sin SDK propio: se envía el evento directamente a la API de ingesta.
 * La DSN tiene la forma `https://<clave>@<host>/<projectId>`.
 */
export function httpSnippet({
	dsn,
	release = "1.0.0",
	environment = "production",
}: SnippetOptions) {
	let endpoint = "https://<host>/api/<projectId>/events";
	let key = "<key>";
	try {
		const url = new URL(dsn);
		key = url.username || key;
		endpoint = `${url.protocol}//${url.host}/api/${url.pathname.replace(/^\/+/, "")}/events`;
	} catch {
		// DSN todavía no disponible: se deja la plantilla.
	}
	return [
		`curl -X POST "${endpoint}" \\`,
		'  -H "Content-Type: application/json" \\',
		`  -H "X-Sentinel-Key: ${key}" \\`,
		`  -d '{"level":"error","message":"Hello from Sentinel","release":"${release}","environment":"${environment}"}'`,
	].join("\n");
}
