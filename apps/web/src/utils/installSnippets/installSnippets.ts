import type { SnippetOptions } from "@/utils/installSnippets/installSnippetsInterface";

/** Instalación con un bundler (npm). */
export function npmSnippet({
	dsn,
	release = "1.0.0",
	environment = "production",
}: SnippetOptions) {
	return {
		install: "npm install @sentinel/browser",
		code: [
			'import * as Sentinel from "@sentinel/browser";',
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
		'<script src="https://your-cdn.example.com/sentinel.min.js"></script>',
		"<script>",
		"  Sentinel.init({",
		`    dsn: "${dsn}",`,
		`    release: "${release}",`,
		`    environment: "${environment}",`,
		"  });",
		"</script>",
	].join("\n");
}

/** Instalación en React: `@sentinel/react` reexporta el SDK del navegador y añade el ErrorBoundary. */
export function reactSnippet({
	dsn,
	release = "1.0.0",
	environment = "production",
}: SnippetOptions) {
	return {
		install: "npm install @sentinel/react",
		code: [
			'import * as Sentinel from "@sentinel/react";',
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
