/** Secciones de la documentación, en orden (`docs.sections.<id>`). Sirven también para el índice lateral. */
export const DOC_SECTIONS = [
	"quickstart",
	"sdks",
	"sourcemaps",
	"tracing",
	"alerts",
	"api",
] as const;

export const PACKAGES = [
	{ id: "javascript", name: "@sentinel/browser" },
	{ id: "react", name: "@sentinel/react" },
	{ id: "node", name: "@sentinel/node" },
	{ id: "python", name: "sentinel-sdk" },
	{ id: "react-native", name: "@sentinel/react-native" },
] as const;

export const QUICKSTART_STEPS = [
	"account",
	"project",
	"dsn",
	"install",
	"verify",
] as const;

export const SOURCEMAPS_COMMAND = [
	"npm install -g https://sentinel.example.com/sdk/sentinel-cli.tgz",
	"sentinel-cli sourcemaps upload ./dist --release 1.4.2",
].join("\n");

export const TRACING_BROWSER = `Sentinel.init({
  dsn: "https://<key>@sentinel.example.com/<projectId>",
  tracesSampleRate: 1,
  // El navegador añade la cabecera \`traceparent\` solo a estas URLs:
  tracePropagationTargets: ["api.mi-empresa.com"],
});`;

export const TRACING_SERVER = `// Tu backend (Node, Python...) continúa la traza que llega en \`traceparent\`:
Sentinel.init({ dsn, tracesSampleRate: 1 });
// -> la transacción del servidor comparte trace_id con la del navegador`;

export const ALERT_RULES = [
	"new_issue",
	"regression",
	"frequency",
	"p95_above",
	"error_rate_above",
] as const;
export const ALERT_CHANNELS = ["email", "webhook", "slack"] as const;

export const ENDPOINTS = [
	{ method: "POST", path: "/api/:projectId/events" },
	{ method: "POST", path: "/api/:projectId/transactions" },
] as const;
