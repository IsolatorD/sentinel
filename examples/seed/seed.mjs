// Puebla Sentinel con datos de demostración realistas.
//   node examples/seed/seed.mjs [--api http://localhost:3000] [--web-origin http://localhost:5173]
// Crea (o reutiliza) un usuario demo, una organización, un proyecto y una variedad de errores.
// Solo para desarrollo local: las credenciales son de prueba.
const argv = process.argv.slice(2);
const args = Object.fromEntries(
	argv.flatMap((a, i) =>
		a.startsWith("--") ? [[a.slice(2), argv[i + 1]]] : [],
	),
);
const API = args.api ?? "http://localhost:3000";
const ORIGIN = args["web-origin"] ?? "http://localhost:5173";
const EMAIL = "demo@sentinel.dev";
const PASSWORD = "demo-password-123";

const cookies = new Map();
async function request(
	path,
	{ method = "GET", body, headers = {}, session = true, redirect } = {},
) {
	const h = { Origin: ORIGIN, ...headers };
	if (body !== undefined) h["Content-Type"] = "application/json";
	if (session && cookies.size)
		h.Cookie = [...cookies].map(([k, v]) => `${k}=${v}`).join("; ");
	const res = await fetch(`${API}${path}`, {
		method,
		headers: h,
		body: body !== undefined ? JSON.stringify(body) : undefined,
		redirect,
	});
	for (const line of res.headers.getSetCookie()) {
		const [pair] = line.split(";");
		const i = pair.indexOf("=");
		cookies.set(pair.slice(0, i), pair.slice(i + 1));
	}
	const text = await res.text();
	let json;
	try {
		json = text ? JSON.parse(text) : undefined;
	} catch {
		json = undefined; // p. ej. la respuesta vacía de una redirección
	}
	return { status: res.status, json };
}
const must = (res, what) => {
	if (res.status >= 400)
		throw new Error(
			`${what} falló (${res.status}): ${JSON.stringify(res.json)}`,
		);
	return res.json;
};

// ---------- usuario, organización, proyecto ----------
/**
 * Si el servidor exige verificar el correo (hay SMTP), abre el enlace del último correo de verificación
 * del usuario demo. En desarrollo esos correos llegan a Mailpit (http://localhost:8025).
 */
async function verifyWithMailpit() {
	const mailpit = process.env.MAILPIT_URL ?? "http://localhost:8025";
	for (let attempt = 0; attempt < 20; attempt++) {
		const found = await fetch(
			`${mailpit}/api/v1/search?query=${encodeURIComponent(`to:${EMAIL}`)}`,
		)
			.then((r) => r.json())
			.catch(() => undefined);
		const message = found?.messages?.[0];
		if (message) {
			const body = await fetch(`${mailpit}/api/v1/message/${message.ID}`).then(
				(r) => r.json(),
			);
			const link = /https?:\/\/\S+verify-email\S+/.exec(body.Text)?.[0];
			if (link) {
				const url = new URL(link);
				const res = await request(`${url.pathname}${url.search}`, {
					redirect: "manual",
				});
				if (res.status >= 300 && res.status < 400) return true;
			}
		}
		await new Promise((r) => setTimeout(r, 500));
	}
	return false;
}

const signIn = () =>
	request("/api/auth/sign-in/email", {
		method: "POST",
		body: { email: EMAIL, password: PASSWORD },
	});
const auth = await signIn();
if (auth.status === 403) {
	// Cuenta existente pero sin verificar: llegó (o se reenvía) un correo.
	if (!(await verifyWithMailpit()))
		throw new Error(
			`${EMAIL} no está verificado y no se encontró el correo en Mailpit. Revisa http://localhost:8025`,
		);
} else if (auth.status !== 200) {
	must(
		await request("/api/auth/sign-up/email", {
			method: "POST",
			body: { name: "Demo User", email: EMAIL, password: PASSWORD },
		}),
		"registro",
	);
	// Con verificación activa el registro no inicia sesión: se verifica y se entra.
	if ((await signIn()).status === 403) await verifyWithMailpit();
}
if (!cookies.size) must(await signIn(), "iniciar sesión");
const orgs = must(
	await request("/api/auth/organization/list"),
	"listar organizaciones",
);
const org =
	orgs.find((o) => o.slug === "acme-demo") ??
	must(
		await request("/api/auth/organization/create", {
			method: "POST",
			body: { name: "Acme", slug: "acme-demo" },
		}),
		"crear organización",
	);
const projects = must(
	await request(`/api/organizations/${org.id}/projects`),
	"listar proyectos",
);
const project =
	projects.find((p) => p.name === "Storefront Web") ??
	must(
		await request(`/api/organizations/${org.id}/projects`, {
			method: "POST",
			body: { name: "Storefront Web", platform: "react" },
		}),
		"crear proyecto",
	);
const detail = must(
	await request(`/api/organizations/${org.id}/projects/${project.id}`),
	"detalle de proyecto",
);
const key = detail.keys[0];

// ---------- eventos ----------
const minutesAgo = (m) => new Date(Date.now() - m * 60_000).toISOString();
const app = (file, fn, lineno, colno = 10) => ({
	filename: `https://shop.acme.dev/assets/${file}`,
	function: fn,
	lineno,
	colno,
	in_app: true,
});
const lib = (file, fn, lineno) => ({
	filename: `https://shop.acme.dev/node_modules/${file}`,
	function: fn,
	lineno,
	colno: 14,
	in_app: false,
});
const reactFrames = [
	lib("react-dom/cjs/react-dom.production.js", "performUnitOfWork", 19320),
	lib("react-dom/cjs/react-dom.production.js", "beginWork", 18412),
];
const UA_CHROME =
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const UA_SAFARI =
	"Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

function crumbs(at, extra = []) {
	return [
		{
			category: "navigation",
			type: "navigation",
			timestamp: minutesAgo(at + 3),
			data: {
				from: "https://shop.acme.dev/",
				to: "https://shop.acme.dev/cart",
			},
		},
		{
			category: "ui.click",
			type: "user",
			timestamp: minutesAgo(at + 2),
			message: "main#app > div.cart > button.checkout",
		},
		{
			category: "fetch",
			type: "http",
			level: "info",
			timestamp: minutesAgo(at + 2),
			data: {
				method: "GET",
				url: "https://shop.acme.dev/api/cart",
				status_code: 200,
				duration_ms: 84,
			},
		},
		{
			category: "console",
			level: "warning",
			timestamp: minutesAgo(at + 1),
			message: "Cart contains stale prices, refreshing",
		},
		...extra,
	];
}

const issues = [
	{
		count: 18,
		users: 7,
		spread: 4200,
		build: (n, at) => ({
			level: "error",
			release: n % 4 === 0 ? "2.3.0" : "2.4.0",
			environment: "production",
			tags: {
				feature: "checkout",
				handled: "false",
				mechanism: "onerror",
				route: "/cart",
			},
			exception: {
				values: [
					{
						type: "TypeError",
						value: "Cannot read properties of undefined (reading 'items')",
						stacktrace: {
							frames: [
								...reactFrames,
								app("Cart.3f2a1b9c.js", "CartPage", 88),
								app("Cart.3f2a1b9c.js", "computeTotal", 42, 17),
							],
						},
					},
				],
			},
			breadcrumbs: crumbs(at, [
				{
					category: "fetch",
					type: "http",
					level: "error",
					timestamp: minutesAgo(at),
					data: {
						method: "POST",
						url: "https://shop.acme.dev/api/cart/price",
						status_code: 500,
						duration_ms: 1210,
					},
				},
			]),
		}),
	},
	{
		count: 11,
		users: 5,
		spread: 3000,
		build: (_n, at) => ({
			level: "error",
			release: "2.4.0",
			environment: "production",
			tags: {
				feature: "search",
				handled: "false",
				mechanism: "onunhandledrejection",
			},
			exception: {
				values: [
					{
						type: "Error",
						value:
							"Network request failed: GET /api/search timed out after 8000ms",
						stacktrace: {
							frames: [
								lib("axios/lib/adapters/xhr.js", "handleTimeout", 91),
								app("search.7c1d9e2a.js", "fetchResults", 31),
								app("search.7c1d9e2a.js", "onQueryChange", 58),
							],
						},
					},
				],
			},
			breadcrumbs: crumbs(at, [
				{
					category: "ui.click",
					type: "user",
					timestamp: minutesAgo(at),
					message: "header > form.search > button[type=submit]",
				},
			]),
		}),
	},
	{
		count: 6,
		users: 3,
		spread: 2500,
		build: (_n, at) => ({
			level: "error",
			release: "2.4.0",
			environment: "production",
			tags: { feature: "checkout", handled: "true" },
			exception: {
				values: [
					{
						type: "Error",
						value: "Card processor timeout",
						stacktrace: {
							frames: [lib("stripe-js/dist/stripe.js", "request", 204)],
						},
					},
					{
						type: "PaymentError",
						value: "Payment declined for order 4821",
						stacktrace: {
							frames: [
								app("checkout.a91f33c0.js", "submitPayment", 140),
								app("checkout.a91f33c0.js", "onSubmit", 77),
							],
						},
					},
				],
			},
			breadcrumbs: crumbs(at),
		}),
	},
	{
		count: 4,
		users: 2,
		spread: 5000,
		build: (_n, at) => ({
			level: "warning",
			release: "2.4.0",
			environment: "production",
			tags: { feature: "analytics" },
			exception: {
				values: [
					{
						type: "ReferenceError",
						value: "analytics is not defined",
						stacktrace: {
							frames: [
								app("track.5be2d9c1.js", "trackPurchase", 12),
								app("Cart.3f2a1b9c.js", "onSuccess", 120),
							],
						},
					},
				],
			},
			breadcrumbs: crumbs(at),
		}),
	},
	{
		count: 3,
		users: 3,
		spread: 6000,
		build: (_n, at) => ({
			level: "error",
			release: "2.3.0",
			environment: "staging",
			tags: { feature: "gallery" },
			exception: {
				values: [
					{
						type: "RangeError",
						value: "Invalid array length",
						stacktrace: {
							frames: [
								app("Gallery.b3d21f77.js", "buildThumbnails", 66),
								app("Gallery.b3d21f77.js", "Gallery", 20),
							],
						},
					},
				],
			},
			breadcrumbs: crumbs(at),
		}),
	},
	{
		count: 5,
		users: 4,
		spread: 1800,
		build: (_n, at) => ({
			level: "error",
			release: "2.4.0",
			environment: "production",
			tags: { feature: "profile", handled: "false", mechanism: "onerror" },
			exception: {
				values: [
					{
						type: "SyntaxError",
						value: "Unexpected token '<', \"<!DOCTYPE \"... is not valid JSON",
						stacktrace: {
							frames: [
								app("api.d0e8a1b2.js", "parseResponse", 27),
								app("Profile.9a77c3e4.js", "loadProfile", 45),
							],
						},
					},
				],
			},
			breadcrumbs: crumbs(at),
		}),
	},
	{
		count: 14,
		users: 9,
		spread: 4000,
		build: (n, at) => ({
			level: "warning",
			release: "2.4.0",
			environment: "production",
			message: `Slow response from search API (${3000 + n * 37}ms)`,
			tags: { feature: "search" },
			breadcrumbs: crumbs(at),
		}),
	},
	{
		count: 2,
		users: 2,
		spread: 800,
		build: (_n, at) => ({
			level: "fatal",
			release: "2.4.0",
			environment: "production",
			tags: { handled: "false", mechanism: "onerror" },
			exception: {
				values: [
					{
						type: "Error",
						value: "Out of memory while decoding image",
						stacktrace: {
							frames: [app("Gallery.b3d21f77.js", "decodeImage", 301)],
						},
					},
				],
			},
			breadcrumbs: crumbs(at),
		}),
	},
	{
		count: 9,
		users: 6,
		spread: 3500,
		build: (n, at) => ({
			level: "info",
			release: "2.4.0",
			environment: "production",
			message: `Coupon SAVE${10 + (n % 3)} applied`,
			tags: { feature: "checkout" },
			breadcrumbs: crumbs(at),
		}),
	},
];

let sent = 0;
for (const issue of issues) {
	for (let n = 0; n < issue.count; n++) {
		const at = Math.floor(
			5 +
				(issue.spread * (issue.count - 1 - n)) / Math.max(1, issue.count - 1) +
				Math.random() * 20,
		);
		const user = `user_${(n % issue.users) + 100}`;
		const mobile = n % 3 === 0;
		const event = {
			timestamp: minutesAgo(at),
			platform: "javascript",
			user: { id: user, email: `${user}@example.com` },
			request: {
				url: "https://shop.acme.dev/cart",
				headers: { "User-Agent": mobile ? UA_SAFARI : UA_CHROME },
			},
			contexts: {
				browser: {
					name: mobile ? "Safari" : "Chrome",
					version: mobile ? "17.5" : "126.0.0",
				},
				os: { name: mobile ? "iOS" : "macOS" },
				sdk: { name: "sentinel.javascript.browser", version: "0.1.0" },
			},
			extra: n === 0 ? { cartId: "cart_8f21", items: 3 } : undefined,
			...issue.build(n, at),
		};
		const res = await fetch(`${API}/api/${project.id}/events`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-Sentinel-Key": key.publicKey,
				"User-Agent": mobile ? UA_SAFARI : UA_CHROME,
			},
			body: JSON.stringify(event),
		});
		if (res.status !== 202)
			throw new Error(`ingesta falló (${res.status}): ${await res.text()}`);
		sent++;
		await new Promise((r) => setTimeout(r, 40)); // no superar el límite de ritmo
	}
}

console.log(`\nDatos de demostración listos (${sent} eventos).`);
console.log(`  Usuario:  ${EMAIL}`);
console.log(`  Password: ${PASSWORD}`);
console.log(`  Proyecto: ${project.name}  (DSN: ${key.dsn})`);
console.log("Espera unos segundos a que el worker los procese.\n");
