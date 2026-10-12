import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema/index.js";

export {
	and,
	asc,
	count,
	countDistinct,
	desc,
	eq,
	exists,
	gte,
	ilike,
	inArray,
	isNull,
	notInArray,
	or,
	sql,
	TransactionRollbackError,
} from "drizzle-orm";
export { runMigrations } from "./migrate.js";
export * from "./schema/index.js";
export { schema };

export function createDb(connectionString: string) {
	const pool = new Pool({ connectionString });
	const db = drizzle(pool, { schema });
	return { db, pool };
}

export type Database = ReturnType<typeof createDb>["db"];
