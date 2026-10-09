import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// Reglas de arquitectura del frontend (ver PLAN.md §2.2), verificadas automáticamente:
//  - Ningún componente ni página llama a un service: solo a través de hooks.
//  - Átomos y moléculas reciben todo por props: no usan hooks de datos.

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
});
