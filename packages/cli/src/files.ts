import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import {
	looksLikeSourceMap,
	MAX_SOURCE_MAP_BYTES,
	normalizeArtifactName,
} from "@sentinel/shared/source-maps";

export interface MapFile {
	/** Ruta absoluta en disco. */
	path: string;
	/** Nombre con el que se sube: `~/assets/app.3f2a.js`. */
	name: string;
}

export interface SkippedFile {
	path: string;
	reason: string;
}

/** `dist/assets/app.js.map` con prefijo `~/` -> `~/assets/app.js`. */
export function artifactNameFor(
	directory: string,
	file: string,
	urlPrefix: string,
): string | null {
	const rel = relative(directory, file).split(sep).join("/");
	const prefix = urlPrefix.endsWith("/") ? urlPrefix : `${urlPrefix}/`;
	return normalizeArtifactName(`${prefix}${rel}`);
}

async function* walk(directory: string): AsyncGenerator<string> {
	for (const entry of await readdir(directory, { withFileTypes: true })) {
		if (entry.name === "node_modules") continue;
		const full = join(directory, entry.name);
		if (entry.isDirectory()) yield* walk(full);
		else if (entry.isFile() && entry.name.endsWith(".map")) yield full;
	}
}

/** Busca los `.map` de un directorio y descarta los que el servidor rechazaría. */
export async function findSourceMaps(
	directory: string,
	urlPrefix: string,
): Promise<{ files: MapFile[]; skipped: SkippedFile[] }> {
	const root = await stat(directory).catch(() => null);
	if (!root?.isDirectory()) {
		throw new Error(`"${directory}" is not a directory.`);
	}

	const files: MapFile[] = [];
	const skipped: SkippedFile[] = [];
	for await (const path of walk(directory)) {
		const name = artifactNameFor(directory, path, urlPrefix);
		if (!name) {
			skipped.push({ path, reason: "invalid file name" });
			continue;
		}
		const { size } = await stat(path);
		if (size === 0 || size > MAX_SOURCE_MAP_BYTES) {
			skipped.push({
				path,
				reason: size === 0 ? "empty file" : "larger than 25 MB",
			});
			continue;
		}
		try {
			if (!looksLikeSourceMap(JSON.parse(await readFile(path, "utf8")))) {
				skipped.push({ path, reason: "not a source map" });
				continue;
			}
		} catch {
			skipped.push({ path, reason: "not valid JSON" });
			continue;
		}
		files.push({ path, name });
	}
	files.sort((a, b) => a.name.localeCompare(b.name));
	return { files, skipped };
}
