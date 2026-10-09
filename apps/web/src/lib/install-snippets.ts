export interface SnippetOptions {
	dsn: string;
	release?: string;
	environment?: string;
}

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
