import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// Reglas de arquitectura del frontend (ver PLAN.md §2.2), verificadas automáticamente:
//  - Ningún componente ni página llama a un service: solo a través de hooks.
//  - Átomos y moléculas reciben todo por props: no usan hooks de datos.
//  - Estructura de carpetas: cada componente, página, hook, service y util vive en una carpeta con su
//    nombre, con sus tipos en [Nombre]Interface.d.ts y sus constantes/helpers en [Nombre].constants.ts.

const SRC = join(__dirname);

function files(dir: string): string[] {
	return readdirSync(dir).flatMap((name) => {
		const path = join(dir, name);
		if (statSync(path).isDirectory()) return files(path);
		return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)
			? [path]
			: [];
	});
}

function importsOf(file: string): string[] {
	const source = readFileSync(file, "utf8");
	return [...source.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]);
}

const isServiceImport = (spec: string) => /(^|\/)services(\/|$)/.test(spec);

function offenders(
	dir: string,
	forbidden: (spec: string) => boolean,
	allow: (file: string, spec: string) => boolean = () => false,
) {
	return files(join(SRC, dir)).flatMap((file) =>
		importsOf(file)
			.filter((spec) => forbidden(spec) && !allow(file, spec))
			.map((spec) => `${relative(SRC, file)} -> ${spec}`),
	);
}

describe("arquitectura del frontend", () => {
	it("hay código en las carpetas que se revisan", () => {
		for (const dir of ["components", "pages", "hooks", "services"]) {
			expect(files(join(SRC, dir)).length, dir).toBeGreaterThan(0);
		}
	});

	it("ningún componente (átomo, molécula, organismo, template) importa un service", () => {
		const found = offenders("components", isServiceImport);
		expect(found, found.join("\n")).toEqual([]);
	});

	it("ninguna página importa un service", () => {
		const found = offenders("pages", isServiceImport);
		expect(found, found.join("\n")).toEqual([]);
	});

	it("átomos y moléculas no usan hooks de datos", () => {
		const isDataHook = (spec: string) => /(^|\/)hooks(\/|$)/.test(spec);
		const found = [
			...offenders("components/atoms", isDataHook),
			...offenders("components/molecules", isDataHook),
		];
		expect(found, found.join("\n")).toEqual([]);
	});

	it("los átomos no dependen de moléculas ni de organismos", () => {
		const found = offenders("components/atoms", (s) =>
			/components\/(molecules|organisms|templates)/.test(s),
		);
		expect(found, found.join("\n")).toEqual([]);
	});

	it("las moléculas no dependen de organismos ni de templates", () => {
		const found = offenders("components/molecules", (s) =>
			/components\/(organisms|templates)/.test(s),
		);
		expect(found, found.join("\n")).toEqual([]);
	});

	it("los hooks son quienes llaman a los services", () => {
		const usesServices = files(join(SRC, "hooks")).some((f) =>
			importsOf(f).some(isServiceImport),
		);
		expect(usesServices).toBe(true);
	});

	describe("estructura de carpetas", () => {
		const LAYERS = [
			"components/atoms",
			"components/molecules",
			"components/organisms",
			"components/templates",
			"pages",
			"hooks",
			"services",
			"utils",
		];
		const withTests = (dir: string): string[] =>
			readdirSync(dir).flatMap((name) => {
				const path = join(dir, name);
				if (statSync(path).isDirectory()) return withTests(path);
				return /\.(ts|tsx)$/.test(name) ? [path] : [];
			});
		const all = LAYERS.flatMap((layer) => withTests(join(SRC, layer)));

		/** `Button.constants.test.tsx` -> `Button`; `ButtonInterface.d.ts` -> `Button`. */
		const stemOf = (file: string) =>
			(file.split("/").pop() ?? "")
				.replace(/\.(d\.ts|tsx|ts)$/, "")
				.replace(/\.test$/, "")
				.replace(/\.constants$/, "")
				.replace(/Interface$/, "");

		it("hay archivos que revisar", () => {
			expect(all.length).toBeGreaterThan(100);
		});

		it("cada archivo vive en una carpeta con su mismo nombre", () => {
			const found = all
				.filter((f) => f.split("/").at(-2) !== stemOf(f))
				.map((f) => relative(SRC, f));
			expect(found, found.join("\n")).toEqual([]);
		});

		it("los tipos viven en [Nombre]Interface.d.ts, no dentro del archivo del componente", () => {
			const found = all
				.filter((f) => !f.endsWith(".d.ts") && !/\.test\.tsx?$/.test(f))
				.filter((f) =>
					/^(export )?(interface|type) \w+/m.test(readFileSync(f, "utf8")),
				)
				.map((f) => relative(SRC, f));
			expect(found, found.join("\n")).toEqual([]);
		});

		it("los archivos .d.ts solo tienen tipos y se llaman [Nombre]Interface.d.ts", () => {
			const dts = all.filter((f) => f.endsWith(".d.ts"));
			expect(dts.length).toBeGreaterThan(0);
			const badName = dts.filter((f) => !f.endsWith("Interface.d.ts"));
			const withValues = dts.filter((f) =>
				/^export (const|let|var|function|class|enum) /m.test(
					readFileSync(f, "utf8"),
				),
			);
			expect([...badName, ...withValues].map((f) => relative(SRC, f))).toEqual(
				[],
			);
		});

		it("cada archivo de componente declara un solo componente", () => {
			const found = all
				.filter((f) => f.endsWith(".tsx") && !/\.test\.tsx$/.test(f))
				.filter(
					(f) =>
						(
							readFileSync(f, "utf8").match(
								/^(export )?(function|const) [A-Z]\w*/gm,
							) ?? []
						).length > 1,
				)
				.map((f) => relative(SRC, f));
			expect(found, found.join("\n")).toEqual([]);
		});

		it("los .constants.ts no contienen componentes", () => {
			const found = all
				.filter((f) => f.endsWith(".constants.ts"))
				.filter((f) =>
					/<\/[A-Za-z]|<[A-Z]\w*(\s[^<>]*)?\/>|React\./.test(
						readFileSync(f, "utf8"),
					),
				)
				.map((f) => relative(SRC, f));
			expect(found, found.join("\n")).toEqual([]);
		});
	});
});
