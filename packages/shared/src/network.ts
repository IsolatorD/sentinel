/**
 * Comprobaciones de red para URLs que el servidor visita por orden de un usuario (webhooks):
 * sin ellas, cualquiera podría apuntar la plataforma a su red interna o a los metadatos de la nube
 * (SSRF). Son puras (no resuelven DNS): quien envía debe validar también cada dirección resuelta
 * con `isPrivateAddress`.
 */

function parseIpv4(ip: string): number[] | null {
	const parts = ip.split(".");
	if (parts.length !== 4) return null;
	const nums = parts.map((p) => (/^\d{1,3}$/.test(p) ? Number(p) : -1));
	return nums.every((n) => n >= 0 && n <= 255) ? nums : null;
}

function isPrivateIpv4([a, b, c]: number[]): boolean {
	return (
		a === 0 || // "esta red"
		a === 10 ||
		a === 127 || // loopback
		(a === 100 && b >= 64 && b <= 127) || // CGNAT
		(a === 169 && b === 254) || // link-local (incluye 169.254.169.254, metadatos de la nube)
		(a === 172 && b >= 16 && b <= 31) ||
		(a === 192 && b === 0 && c === 0) ||
		(a === 192 && b === 168) ||
		(a === 198 && (b === 18 || b === 19)) || // pruebas de rendimiento
		a >= 224 // multicast y reservadas
	);
}

/** Expande una dirección IPv6 a sus 8 grupos de 16 bits; null si no es válida. */
function parseIpv6(ip: string): number[] | null {
	let text = ip.toLowerCase();
	const zone = text.indexOf("%");
	if (zone !== -1) text = text.slice(0, zone);

	// Forma con IPv4 al final (::ffff:127.0.0.1)
	const lastColon = text.lastIndexOf(":");
	const tail = text.slice(lastColon + 1);
	if (tail.includes(".")) {
		const v4 = parseIpv4(tail);
		if (!v4) return null;
		text = `${text.slice(0, lastColon + 1)}${((v4[0] << 8) | v4[1]).toString(16)}:${((v4[2] << 8) | v4[3]).toString(16)}`;
	}

	const halves = text.split("::");
	if (halves.length > 2) return null;
	const parse = (s: string) => (s === "" ? [] : s.split(":"));
	const head = parse(halves[0]);
	const rest = halves.length === 2 ? parse(halves[1]) : [];
	const missing = 8 - head.length - rest.length;
	if (halves.length === 1 ? head.length !== 8 : missing < 0) return null;
	const groups = [
		...head,
		...Array(halves.length === 2 ? missing : 0).fill("0"),
		...rest,
	];
	const nums = groups.map((g) =>
		/^[0-9a-f]{1,4}$/.test(g) ? Number.parseInt(g, 16) : -1,
	);
	return nums.length === 8 && nums.every((n) => n >= 0) ? nums : null;
}

/** `true` si la dirección es privada, de loopback, link-local, reservada o no se puede interpretar. */
export function isPrivateAddress(ip: string): boolean {
	const text = ip.trim().replace(/^\[|\]$/g, "");
	const v4 = parseIpv4(text);
	if (v4) return isPrivateIpv4(v4);
	const v6 = parseIpv6(text);
	if (!v6) return true; // ante la duda, se bloquea
	// IPv4 mapeada (::ffff:a.b.c.d) o compatible: se evalúa como IPv4
	if (
		v6.slice(0, 5).every((g) => g === 0) &&
		(v6[5] === 0xffff || v6[5] === 0)
	) {
		const v4mapped = [v6[6] >> 8, v6[6] & 255, v6[7] >> 8, v6[7] & 255];
		if (v6[5] === 0xffff || v6.slice(0, 6).every((g) => g === 0)) {
			// :: y ::1 son "no especificada" y loopback: caen aquí con a=0
			return isPrivateIpv4(v4mapped);
		}
	}
	const first = v6[0];
	return (
		(first & 0xfe00) === 0xfc00 || // fc00::/7 (únicas locales)
		(first & 0xffc0) === 0xfe80 || // fe80::/10 (link-local)
		(first & 0xff00) === 0xff00 || // ff00::/8 (multicast)
		(v6[0] === 0x64 && v6[1] === 0xff9b) || // 64:ff9b::/96 (NAT64)
		first === 0x2002 // 6to4
	);
}

const BLOCKED_SUFFIXES = [
	".localhost",
	".local",
	".internal",
	".intranet",
	".lan",
	".home",
	".corp",
];

/** Nombres que nunca deben visitarse, sin necesidad de resolver DNS. */
export function isBlockedHostname(hostname: string): boolean {
	const host = hostname
		.toLowerCase()
		.replace(/\.$/, "")
		.replace(/^\[|\]$/g, "");
	if (host === "localhost" || host === "metadata.google.internal") return true;
	if (BLOCKED_SUFFIXES.some((s) => host.endsWith(s))) return true;
	const looksLikeIp = /^[\d.]+$/.test(host) || host.includes(":");
	return looksLikeIp ? isPrivateAddress(host) : false;
}

export type WebhookUrlCheck =
	| { ok: true; url: URL }
	| { ok: false; reason: string };

/** Valida la forma de una URL de webhook (esquema, credenciales y host evidentemente interno). */
export function checkWebhookUrl(
	raw: string,
	{ allowPrivate = false }: { allowPrivate?: boolean } = {},
): WebhookUrlCheck {
	let url: URL;
	try {
		url = new URL(raw);
	} catch {
		return { ok: false, reason: "Invalid URL" };
	}
	if (url.protocol !== "https:" && url.protocol !== "http:")
		return { ok: false, reason: "The URL must start with http:// or https://" };
	if (url.username || url.password)
		return { ok: false, reason: "The URL must not contain credentials" };
	if (!allowPrivate && isBlockedHostname(url.hostname))
		return {
			ok: false,
			reason: "The URL points to a private or internal address",
		};
	return { ok: true, url };
}
