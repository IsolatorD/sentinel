/**
 * Eliminación de datos sensibles de un evento antes de encolarlo (así nunca llegan a Redis ni a la
 * base de datos). Dos defensas complementarias:
 *  1. Por clave: el valor de `password`, `authorization`, `cookie`, `api_key`... se reemplaza entero.
 *  2. Por contenido: en cualquier texto se filtran los patrones inconfundibles (JWT, `Bearer ...`,
 *     tarjetas válidas según Luhn, claves de AWS/GitHub/Stripe/Slack, credenciales en URLs...).
 * Es pura y no usa zod, así que también la puede usar un SDK.
 */

export const FILTERED = "[Filtered]";
const MAX_DEPTH = 20;

/** Fragmentos que, dentro de una clave normalizada (minúsculas, sin `_`, `-` ni espacios), marcan un secreto. */
const SENSITIVE_KEY_PARTS = [
	"password",
	"passwd",
	"passphrase",
	"pwd",
	"secret",
	"token",
	"apikey",
	"accesskey",
	"privatekey",
	"authorization",
	"cookie",
	"creditcard",
	"cardnumber",
	"cardnum",
	"cvv",
	"cvc",
	"ssn",
	"sessionid",
	"csrf",
	"xsrf",
];
// "auth" suelto (`{ auth: "..." }`) sin atrapar "author".
const SENSITIVE_KEY_EXACT = new Set(["auth", "pin", "otp", "jwt", "signature"]);

export function isSensitiveKey(key: string): boolean {
	const normalized = key.toLowerCase().replace(/[\s_-]/g, "");
	return (
		SENSITIVE_KEY_EXACT.has(normalized) ||
		SENSITIVE_KEY_PARTS.some((part) => normalized.includes(part))
	);
}

/** Campos de identificación del evento: no son texto libre y filtrarlos solo causaría falsos positivos. */
const STRUCTURAL_KEYS = new Set([
	"event_id",
	"timestamp",
	"level",
	"platform",
	"release",
	"environment",
	"fingerprint",
]);

function passesLuhn(digits: string): boolean {
	let sum = 0;
	let double = false;
	for (let i = digits.length - 1; i >= 0; i--) {
		let n = digits.charCodeAt(i) - 48;
		if (double) {
			n *= 2;
			if (n > 9) n -= 9;
		}
		sum += n;
		double = !double;
	}
	return sum % 10 === 0;
}

// 13-19 dígitos, juntos o separados por espacios/guiones, con prefijo de tarjeta (2-6) y Luhn válido.
const CARD = /(?<![\d-])[2-6]\d{3}(?:[ -]?\d){9,15}(?![\d-])/g;

const SENSITIVE_NAME =
	"(?:password|passwd|pwd|secret|(?:access|refresh|auth|id|api)[_-]?token|token|api[_-]?key|apikey|authorization|client[_-]?secret)";

const TEXT_RULES: Array<[RegExp, string | ((...m: string[]) => string)]> = [
	[
		/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY-----|$)/g,
		FILTERED,
	],
	[/\beyJ[\w-]{5,}\.eyJ[\w-]{5,}\.[\w-]*/g, FILTERED], // JWT
	[
		/\b(Bearer|Basic)\s+[\w.~+/=-]{8,}/gi,
		(_m, scheme) => `${scheme} ${FILTERED}`,
	],
	[/\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g, FILTERED], // AWS
	[/\bgh[pousr]_[A-Za-z0-9]{30,}\b/g, FILTERED], // GitHub
	[/\b[sr]k_(?:live|test)_[A-Za-z0-9]{16,}\b/g, FILTERED], // Stripe
	[/\bxox[abposr]-[A-Za-z0-9-]{10,}\b/g, FILTERED], // Slack
	[/\bsnt_[0-9a-f]{48}\b/g, FILTERED], // tokens de esta plataforma
	// usuario:contraseña@ dentro de una URL
	[
		/(\b[a-z][a-z0-9+.-]*:\/\/[^\s/:@]+:)[^\s/@]+(@)/gi,
		(_m, head, at) => `${head}${FILTERED}${at}`,
	],
	// ?token=abc&x=1  ->  ?token=[Filtered]&x=1
	[
		new RegExp(`([?&;]${SENSITIVE_NAME}=)(?!\\[Filtered\\])[^&#\\s]+`, "gi"),
		(_m, head) => `${head}${FILTERED}`,
	],
	// password=hunter2   |   "password":"hunter2"   (no `token: expirado`: es un mensaje, no un valor)
	[
		new RegExp(
			`(\\b${SENSITIVE_NAME}\\b["']?\\s*(?:=|["']\\s*:)\\s*["']?)(?!\\[Filtered\\])[^\\s"'&,;)}\\]]+`,
			"gi",
		),
		(_m, head) => `${head}${FILTERED}`,
	],
];

/** Filtra los patrones sensibles de un texto libre. */
export function scrubText(text: string): string {
	let result = text;
	for (const [pattern, replacement] of TEXT_RULES) {
		result = result.replace(pattern, replacement as string);
	}
	return result.replace(CARD, (match) => {
		const digits = match.replace(/\D/g, "");
		return digits.length >= 13 && digits.length <= 19 && passesLuhn(digits)
			? FILTERED
			: match;
	});
}

function scrubValue(value: unknown, depth: number): unknown {
	if (typeof value === "string") return scrubText(value);
	if (value === null || typeof value !== "object") return value;
	if (depth >= MAX_DEPTH) return "[Truncated]";
	if (Array.isArray(value)) return value.map((v) => scrubValue(v, depth + 1));
	const out: Record<string, unknown> = {};
	for (const [key, inner] of Object.entries(value)) {
		out[key] = isSensitiveKey(key) ? FILTERED : scrubValue(inner, depth + 1);
	}
	return out;
}

/** Devuelve una copia del evento sin datos sensibles; no modifica el original. */
export function scrubEvent<T extends object>(event: T): T {
	const out: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(event)) {
		if (STRUCTURAL_KEYS.has(key)) out[key] = value;
		else if (isSensitiveKey(key)) out[key] = FILTERED;
		else if (key === "user" && value && typeof value === "object") {
			// El id es un identificador del cliente (puede ser numérico y largo): no es texto libre.
			const { id, ...rest } = value as Record<string, unknown>;
			out[key] = {
				...(scrubValue(rest, 1) as Record<string, unknown>),
				...(id !== undefined && { id }),
			};
		} else out[key] = scrubValue(value, 1);
	}
	return out as T;
}
