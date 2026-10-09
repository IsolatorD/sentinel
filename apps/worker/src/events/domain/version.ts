// Comparación de versiones de release. La mayoría de las apps usan semver ("2.4.0", "v1.2.3-beta.1"),
// pero un release puede ser cualquier texto (un hash de git, una fecha): en ese caso se ordena
// por cuándo se creó la release.

interface Semver {
	major: number;
	minor: number;
	patch: number;
	prerelease: string[];
}

const SEMVER =
	/^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/;

export function parseSemver(version: string): Semver | undefined {
	const m = SEMVER.exec(version.trim());
	if (!m) return undefined;
	// "2024-01-15" no es semver: un sufijo con guion solo se acepta si hay al menos mayor.menor.
	if (m[4] && m[2] === undefined) return undefined;
	return {
		major: Number(m[1]),
		minor: Number(m[2] ?? 0),
		patch: Number(m[3] ?? 0),
		prerelease: m[4] ? m[4].split(".") : [],
	};
}

function comparePrerelease(a: string[], b: string[]): number {
	// Una versión sin prerelease es MAYOR que la misma con prerelease (2.0.0 > 2.0.0-rc.1).
	if (a.length === 0 && b.length === 0) return 0;
	if (a.length === 0) return 1;
	if (b.length === 0) return -1;
	for (let i = 0; i < Math.max(a.length, b.length); i++) {
		const x = a[i];
		const y = b[i];
		if (x === undefined) return -1;
		if (y === undefined) return 1;
		const xNum = /^\d+$/.test(x);
		const yNum = /^\d+$/.test(y);
		if (xNum && yNum) {
			if (Number(x) !== Number(y)) return Number(x) < Number(y) ? -1 : 1;
		} else if (xNum !== yNum) {
			return xNum ? -1 : 1; // los identificadores numéricos van antes que los alfanuméricos
		} else if (x !== y) {
			return x < y ? -1 : 1;
		}
	}
	return 0;
}

/** Negativo si a < b, 0 si son equivalentes, positivo si a > b. `undefined` si no es semver. */
export function compareSemver(a: string, b: string): number | undefined {
	const x = parseSemver(a);
	const y = parseSemver(b);
	if (!x || !y) return undefined;
	for (const key of ["major", "minor", "patch"] as const) {
		if (x[key] !== y[key]) return x[key] < y[key] ? -1 : 1;
	}
	return comparePrerelease(x.prerelease, y.prerelease);
}

/**
 * Compara dos releases: por semver si ambas lo son; si no, por la fecha en que se crearon.
 * Devuelve `undefined` si no se puede decidir (el llamador debe tratarlo con cautela).
 */
export function compareReleases(
	a: string,
	b: string,
	createdAt?: (version: string) => Date | undefined,
): number | undefined {
	if (a === b) return 0;
	const semver = compareSemver(a, b);
	if (semver !== undefined) return semver;
	const da = createdAt?.(a);
	const db = createdAt?.(b);
	if (!da || !db) return undefined;
	const diff = da.getTime() - db.getTime();
	return diff === 0 ? undefined : Math.sign(diff);
}
