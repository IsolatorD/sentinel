import { readFile } from "node:fs/promises";
import type { UploadOptions } from "./args.js";
import type { MapFile } from "./files.js";

export type UploadResult =
	| { file: MapFile; ok: true; size: number }
	| { file: MapFile; ok: false; error: string };

const ATTEMPTS = 3;
const RETRY_DELAY_MS = 500;

const endpoint = (o: UploadOptions, file: MapFile) =>
	`${o.url}/api/organizations/${encodeURIComponent(o.org)}/projects/${encodeURIComponent(o.project)}` +
	`/releases/${encodeURIComponent(o.release)}/artifacts?name=${encodeURIComponent(file.name)}`;

/** Mensaje legible a partir de la respuesta de error de la API (`ErrorResponse`) o del estado HTTP. */
async function describeFailure(res: Response): Promise<string> {
	try {
		const body = (await res.json()) as { message?: unknown };
		if (typeof body.message === "string")
			return `${res.status} ${body.message}`;
	} catch {
		// Respuesta sin JSON (p. ej. un proxy): se informa solo el estado.
	}
	return `${res.status} ${res.statusText}`.trim();
}

/** Sube un archivo. Reintenta ante fallos de red y errores 5xx; un 4xx no se reintenta. */
export async function uploadOne(
	options: UploadOptions,
	file: MapFile,
	sleep: (ms: number) => Promise<void> = (ms) =>
		new Promise((r) => setTimeout(r, ms)),
): Promise<UploadResult> {
	const body = await readFile(file.path);
	let error = "unknown error";
	for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
		try {
			const res = await fetch(endpoint(options, file), {
				method: "PUT",
				headers: {
					Authorization: `Bearer ${options.token}`,
					"Content-Type": "application/octet-stream",
				},
				body,
			});
			if (res.ok) return { file, ok: true, size: body.length };
			error = await describeFailure(res);
			if (res.status < 500 && res.status !== 429) break;
		} catch (cause) {
			error = (cause as Error).message;
		}
		if (attempt < ATTEMPTS) await sleep(RETRY_DELAY_MS * attempt);
	}
	return { file, ok: false, error };
}

/** Sube todos con un máximo de peticiones simultáneas. */
export async function uploadAll(
	options: UploadOptions,
	files: MapFile[],
	onResult: (result: UploadResult) => void,
	concurrency = 4,
	sleep?: (ms: number) => Promise<void>,
): Promise<UploadResult[]> {
	const results: UploadResult[] = [];
	let next = 0;
	const worker = async () => {
		while (next < files.length) {
			const file = files[next++];
			const result = await uploadOne(options, file, sleep);
			results.push(result);
			onResult(result);
		}
	};
	await Promise.all(
		Array.from({ length: Math.min(concurrency, files.length) }, worker),
	);
	return results.sort((a, b) => a.file.name.localeCompare(b.file.name));
}
