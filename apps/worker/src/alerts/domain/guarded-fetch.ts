import dns from "node:dns";
import type { LookupFunction } from "node:net";
import { checkWebhookUrl, isPrivateAddress } from "@sentinel/shared";
import { Agent, fetch as undiciFetch } from "undici";
import { DeliveryError } from "./delivery-error.js";

export interface GuardedFetchOptions {
	method: "POST";
	headers: Record<string, string>;
	body: string;
	/** Permite direcciones privadas (solo desarrollo y pruebas). */
	allowPrivate: boolean;
	timeoutMs?: number;
}

/**
 * Resuelve el DNS y rechaza cualquier dirección privada en el momento de conectar. Validar la URL
 * antes no basta: un nombre puede apuntar a una IP pública al validar y a una interna al conectar
 * (DNS rebinding). Al fijar la comprobación en la resolución, la dirección validada es la usada.
 */
const guardedLookup: LookupFunction = (hostname, options, callback) => {
	dns.lookup(hostname, { ...options, all: true }, (error, addresses) => {
		if (error) return callback(error, "", 0);
		const list = addresses as dns.LookupAddress[];
		const blocked = list.find((a) => isPrivateAddress(a.address));
		if (blocked || list.length === 0) {
			return callback(
				new Error(`Blocked address for ${hostname}`) as NodeJS.ErrnoException,
				"",
				0,
			);
		}
		if (options.all) {
			// biome-ignore lint/suspicious/noExplicitAny: la firma de LookupFunction no modela la forma con `all`
			return (callback as any)(null, list);
		}
		return callback(null, list[0].address, list[0].family);
	});
};

const strictAgent = new Agent({ connect: { lookup: guardedLookup } });
const openAgent = new Agent();

/** POST a una URL aportada por un usuario, sin seguir redirecciones y con tiempo máximo. */
export async function guardedFetch(
	rawUrl: string,
	options: GuardedFetchOptions,
): Promise<{ status: number }> {
	const check = checkWebhookUrl(rawUrl, { allowPrivate: options.allowPrivate });
	if (!check.ok) throw new DeliveryError(check.reason, { permanent: true });

	try {
		const res = await undiciFetch(check.url, {
			method: options.method,
			headers: options.headers,
			body: options.body,
			redirect: "manual",
			signal: AbortSignal.timeout(options.timeoutMs ?? 10_000),
			dispatcher: options.allowPrivate ? openAgent : strictAgent,
		});
		// No se lee el cuerpo: solo importa el estado.
		await res.body?.cancel();
		return { status: res.status };
	} catch (cause) {
		const error = cause as Error & { cause?: Error };
		const reason = error.cause?.message ?? error.message;
		if (/Blocked address/.test(reason))
			throw new DeliveryError("The URL resolves to a private address", {
				permanent: true,
			});
		throw new DeliveryError(
			error.name === "TimeoutError" ? "The request timed out" : reason,
		);
	}
}
