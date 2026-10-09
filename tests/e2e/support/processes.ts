import { type ChildProcess, spawn } from "node:child_process";
import { closeSync, mkdirSync, openSync, readFileSync } from "node:fs";
import { createServer } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
export const repoRoot = join(here, "../../..");
export const logDir = join(here, "../.logs");

export interface ManagedProcess {
	name: string;
	child: ChildProcess;
	logFile: string;
	exited: boolean;
}

export async function freePort(): Promise<number> {
	return new Promise((resolve, reject) => {
		const server = createServer();
		server.once("error", reject);
		server.listen(0, "127.0.0.1", () => {
			const { port } = server.address() as { port: number };
			server.close(() => resolve(port));
		});
	});
}

/** Arranca `node dist/main.js` de una app compilada, con un entorno explícito y mínimo. */
export function startApp(
	name: "api" | "worker",
	env: Record<string, string>,
): ManagedProcess {
	mkdirSync(logDir, { recursive: true });
	const logFile = join(logDir, `${name}.log`);
	const fd = openSync(logFile, "w");
	const child = spawn(process.execPath, ["dist/main.js"], {
		cwd: join(repoRoot, "apps", name),
		// Entorno mínimo: así no se cuelan variables del desarrollador (DATABASE_URL, etc.).
		env: { PATH: process.env.PATH ?? "", HOME: process.env.HOME ?? "", ...env },
		stdio: ["ignore", fd, fd],
	});
	closeSync(fd);
	const managed: ManagedProcess = { name, child, logFile, exited: false };
	child.once("exit", () => {
		managed.exited = true;
	});
	return managed;
}

export function tail(logFile: string, lines = 30): string {
	try {
		return readFileSync(logFile, "utf8").split("\n").slice(-lines).join("\n");
	} catch {
		return "(sin log)";
	}
}

export async function waitFor(
	check: () => Promise<boolean>,
	{
		timeoutMs,
		label,
		processes = [],
	}: { timeoutMs: number; label: string; processes?: ManagedProcess[] },
): Promise<void> {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		for (const p of processes) {
			if (p.exited) {
				throw new Error(
					`${p.name} terminó antes de estar listo:\n${tail(p.logFile)}`,
				);
			}
		}
		if (await check().catch(() => false)) return;
		await new Promise((r) => setTimeout(r, 250));
	}
	const logs = processes
		.map((p) => `--- ${p.name} ---\n${tail(p.logFile)}`)
		.join("\n");
	throw new Error(`Tiempo agotado esperando: ${label}\n${logs}`);
}

export async function stop(p: ManagedProcess): Promise<void> {
	if (p.exited) return;
	p.child.kill("SIGTERM");
	await new Promise<void>((resolve) => {
		const timer = setTimeout(() => {
			p.child.kill("SIGKILL");
			resolve();
		}, 5_000);
		p.child.once("exit", () => {
			clearTimeout(timer);
			resolve();
		});
	});
}
