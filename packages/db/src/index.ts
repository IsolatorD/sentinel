import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema/index.js";

export { and, desc, eq } from "drizzle-orm";
export * from "./schema/index.js";
export { schema };

export function createDb(connectionString: string) {
	const pool = new Pool({ connectionString });
	const db = drizzle(pool, { schema });
	return { db, pool };
}

export type Database = ReturnType<typeof createDb>["db"];
