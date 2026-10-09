import { parseArgs } from "node:util";

export const USAGE = `Sentinel CLI

Usage:
  sentinel-cli sourcemaps upload <directory> --release <version> [options]

Options:
  -r, --release <version>   Release the build belongs to (or SENTINEL_RELEASE)
      --url <url>           Sentinel API origin, e.g. https://sentinel.example.com (or SENTINEL_URL)
      --token <token>       API token of the organization (or SENTINEL_AUTH_TOKEN)
      --org <id>            Organization id (or SENTINEL_ORG)
      --project <id>        Project id (or SENTINEL_PROJECT)
      --url-prefix <prefix> Where the files are served from (default "~/", i.e. the site root)
      --dry-run             Show what would be uploaded without uploading anything
  -h, --help                Show this help
`;

export interface UploadOptions {
	directory: string;
	release: string;
	url: string;
	token: string;
	org: string;
	project: string;
	urlPrefix: string;
	dryRun: boolean;
}

export type ParsedCommand =
	| { kind: "help" }
	| { kind: "upload"; options: UploadOptions }
	| { kind: "error"; message: string };

type Env = Record<string, string | undefined>;

/** Interpreta la línea de comandos. Es pura: no toca el disco ni la red. */
export function parseCommand(argv: string[], env: Env): ParsedCommand {
	let parsed: Parsed;
	try {
		parsed = parseArgs({
			args: argv,
			options: OPTIONS,
			allowPositionals: true,
		});
	} catch (error) {
		return { kind: "error", message: (error as Error).message };
	}
	const { values, positionals } = parsed;
	if (values.help || positionals.length === 0) return { kind: "help" };

	const [group, action, directory, ...extra] = positionals;
	if (group !== "sourcemaps" || action !== "upload") {
		return {
			kind: "error",
			message: `Unknown command: ${positionals.join(" ")}`,
		};
	}
	if (!directory) {
		return {
			kind: "error",
			message: "Missing <directory> with the built files.",
		};
	}
	if (extra.length > 0) {
		return { kind: "error", message: `Unexpected argument: ${extra[0]}` };
	}

	const options = {
		directory,
		release: values.release ?? env.SENTINEL_RELEASE,
		url: values.url ?? env.SENTINEL_URL,
		token: values.token ?? env.SENTINEL_AUTH_TOKEN,
		org: values.org ?? env.SENTINEL_ORG,
		project: values.project ?? env.SENTINEL_PROJECT,
	};
	const missing = (
		[
			["release", "--release or SENTINEL_RELEASE"],
			["url", "--url or SENTINEL_URL"],
			["token", "--token or SENTINEL_AUTH_TOKEN"],
			["org", "--org or SENTINEL_ORG"],
			["project", "--project or SENTINEL_PROJECT"],
		] as const
	).filter(([key]) => !options[key]?.trim());
	if (missing.length > 0) {
		return {
			kind: "error",
			message: `Missing required settings:\n${missing.map(([, how]) => `  - ${how}`).join("\n")}`,
		};
	}

	let url: URL;
	try {
		url = new URL(options.url as string);
	} catch {
		return { kind: "error", message: `Invalid --url: ${options.url}` };
	}
	if (url.protocol !== "http:" && url.protocol !== "https:") {
		return {
			kind: "error",
			message: "--url must start with http:// or https://",
		};
	}

	return {
		kind: "upload",
		options: {
			directory,
			release: (options.release as string).trim(),
			url: url.origin + url.pathname.replace(/\/+$/, ""),
			token: (options.token as string).trim(),
			org: (options.org as string).trim(),
			project: (options.project as string).trim(),
			urlPrefix: values["url-prefix"] ?? "~/",
			dryRun: values["dry-run"] ?? false,
		},
	};
}

type Parsed = {
	values: ReturnType<typeof parseArgs<{ options: typeof OPTIONS }>>["values"];
	positionals: string[];
};

const OPTIONS = {
	release: { type: "string", short: "r" },
	url: { type: "string" },
	token: { type: "string" },
	org: { type: "string" },
	project: { type: "string" },
	"url-prefix": { type: "string" },
	"dry-run": { type: "boolean" },
	help: { type: "boolean", short: "h" },
} as const;
