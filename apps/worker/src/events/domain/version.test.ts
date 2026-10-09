import { describe, expect, it } from "vitest";
import { compareReleases, compareSemver, parseSemver } from "./version.js";

describe("parseSemver", () => {
	it("acepta variantes habituales", () => {
		expect(parseSemver("2.4.1")).toEqual({
			major: 2,
			minor: 4,
			patch: 1,
			prerelease: [],
		});
		expect(parseSemver("v1.2")).toEqual({
			major: 1,
			minor: 2,
			patch: 0,
			prerelease: [],
		});
		expect(parseSemver("3")).toMatchObject({ major: 3, minor: 0, patch: 0 });
		expect(parseSemver("1.0.0-rc.1+build.5")?.prerelease).toEqual(["rc", "1"]);
	});

	it("rechaza lo que no es una versión", () => {
		for (const v of ["abc1234", "2024-01-15", "release-final", ""])
			expect(parseSemver(v), v).toBeUndefined();
	});
});

describe("compareSemver", () => {
	const lt = (a: string, b: string) =>
		expect(compareSemver(a, b), `${a} < ${b}`).toBeLessThan(0);

	it("ordena numéricamente, no como texto", () => {
		lt("1.2.9", "1.2.10");
		lt("1.9.0", "1.10.0");
		lt("2.0.0", "10.0.0");
		expect(compareSemver("1.2.3", "v1.2.3")).toBe(0);
	});

	it("una prerelease es anterior a la versión final", () => {
		lt("2.0.0-rc.1", "2.0.0");
		lt("2.0.0-alpha", "2.0.0-beta");
		lt("2.0.0-rc.2", "2.0.0-rc.10");
		lt("2.0.0-1", "2.0.0-alpha");
		lt("1.0.0-alpha", "1.0.0-alpha.1");
	});

	it("la metadata de build no cuenta", () => {
		expect(compareSemver("1.0.0+a", "1.0.0+b")).toBe(0);
	});

	it("devuelve undefined si alguna no es semver", () => {
		expect(compareSemver("1.0.0", "abc123")).toBeUndefined();
	});
});

describe("compareReleases", () => {
	const dates: Record<string, Date> = {
		abc123: new Date("2026-10-01T00:00:00Z"),
		def456: new Date("2026-10-05T00:00:00Z"),
		same1: new Date("2026-10-05T00:00:00Z"),
	};
	const createdAt = (v: string) => dates[v];

	it("usa semver cuando se puede", () => {
		expect(compareReleases("2.0.0", "1.9.9", createdAt)).toBeGreaterThan(0);
	});

	it("si no son semver, ordena por la fecha de creación de la release", () => {
		expect(compareReleases("def456", "abc123", createdAt)).toBe(1);
		expect(compareReleases("abc123", "def456", createdAt)).toBe(-1);
	});

	it("la misma release es igual; sin datos suficientes no se puede decidir", () => {
		expect(compareReleases("abc123", "abc123")).toBe(0);
		expect(compareReleases("abc123", "zzz999", createdAt)).toBeUndefined();
		expect(compareReleases("def456", "same1", createdAt)).toBeUndefined();
		expect(compareReleases("abc123", "def456")).toBeUndefined();
	});
});
