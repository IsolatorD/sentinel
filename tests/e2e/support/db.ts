import pg from "pg";
import { inject } from "vitest";

let pool: pg.Pool | undefined;

/** Acceso directo a la base de pruebas, para comprobar el estado real (conteos, cascada). */
export function db(): pg.Pool {
	pool ??= new pg.Pool({ connectionString: inject("e2e").databaseUrl, max: 2 });
	return pool;
}

export async function scalar<T = number>(
	sql: string,
	params: unknown[] = [],
): Promise<T> {
	const { rows } = await db().query(sql, params);
	const value = Object.values(rows[0] ?? {})[0];
	return (
		typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value
	) as T;
}

export async function closeDb() {
	await pool?.end();
	pool = undefined;
}
