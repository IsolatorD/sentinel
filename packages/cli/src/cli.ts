import { parseCommand, USAGE } from "./args.js";
import { findSourceMaps } from "./files.js";
import { uploadAll } from "./upload.js";

export interface Io {
	out: (line: string) => void;
	err: (line: string) => void;
}

const kb = (bytes: number) => `${(bytes / 1024).toFixed(1)} KB`;

/** Ejecuta la CLI y devuelve el código de salida (0 = todo bien). */
export async function run(
	argv: string[],
	env: Record<string, string | undefined>,
	io: Io,
	sleep?: (ms: number) => Promise<void>,
): Promise<number> {
	const command = parseCommand(argv, env);
	if (command.kind === "help") {
		io.out(USAGE);
		return 0;
	}
	if (command.kind === "error") {
		io.err(`Error: ${command.message}\n\n${USAGE}`);
		return 2;
	}

	const { options } = command;
	let found: Awaited<ReturnType<typeof findSourceMaps>>;
	try {
		found = await findSourceMaps(options.directory, options.urlPrefix);
	} catch (error) {
		io.err(`Error: ${(error as Error).message}`);
		return 2;
	}
	for (const s of found.skipped) io.err(`Skipped ${s.path}: ${s.reason}`);
	if (found.files.length === 0) {
		io.err(`Error: no source maps (*.map) found in "${options.directory}".`);
		return 1;
	}

	io.out(
		`${options.dryRun ? "Would upload" : "Uploading"} ${found.files.length} source map(s) for release ${options.release}`,
	);
	if (options.dryRun) {
		for (const f of found.files) io.out(`  ${f.name}  <-  ${f.path}`);
		return 0;
	}

	const results = await uploadAll(
		options,
		found.files,
		(r) =>
			io.out(
				r.ok
					? `  ✓ ${r.file.name} (${kb(r.size)})`
					: `  ✗ ${r.file.name}: ${r.error}`,
			),
		4,
		sleep,
	);
	const failed = results.filter((r) => !r.ok).length;
	if (failed > 0) {
		io.err(`${failed} of ${results.length} file(s) failed to upload.`);
		return 1;
	}
	io.out(`Done. ${results.length} file(s) uploaded.`);
	return 0;
}
