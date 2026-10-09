import { stringify } from "../normalize";
import type { Level } from "../types";
import type { AddBreadcrumb, Uninstall } from "./types";

const LEVELS: Record<string, Level> = {
	log: "info",
	info: "info",
	warn: "warning",
	error: "error",
	debug: "debug",
};

type ConsoleMethod = (...args: unknown[]) => void;

/** Referencia a la consola original, para que los logs del propio SDK no generen breadcrumbs. */
export const originalConsole: Record<string, ConsoleMethod> | undefined =
	typeof console !== "undefined"
		? Object.fromEntries(
				Object.keys(LEVELS).map((m) => [
					m,
					(
						(console as unknown as Record<string, ConsoleMethod>)[m] ??
						(() => {})
					).bind(console),
				]),
			)
		: undefined;

export function installConsole(add: AddBreadcrumb): Uninstall {
	if (typeof console === "undefined") return () => {};
	const target = console as unknown as Record<string, ConsoleMethod>;
	const originals: Array<[string, ConsoleMethod]> = [];

	for (const method of Object.keys(LEVELS)) {
		const original = target[method];
		if (typeof original !== "function") continue;
		originals.push([method, original]);

		const wrapped: ConsoleMethod = function (
			this: unknown,
			...args: unknown[]
		) {
			try {
				add({
					category: "console",
					level: LEVELS[method],
					message: args.map((a) => stringify(a, 500)).join(" "),
				});
			} catch {
				// Nunca interferir con la app.
			}
			return original.apply(this, args);
		};
		target[method] = wrapped;
	}

	return () => {
		for (const [method, original] of originals) target[method] = original;
	};
}
