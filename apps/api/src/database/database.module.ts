import { Global, Inject, Module, type OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createDb } from "@sentinel/db";

export const DB = Symbol("DB");
export const DB_POOL = Symbol("DB_POOL");

@Global()
@Module({
	providers: [
		{
			provide: DB_POOL,
			inject: [ConfigService],
			useFactory: (config: ConfigService) =>
				createDb(config.getOrThrow<string>("DATABASE_URL")),
		},
		{
			provide: DB,
			inject: [DB_POOL],
			useFactory: (conn: ReturnType<typeof createDb>) => conn.db,
		},
	],
	exports: [DB],
})
export class DatabaseModule implements OnModuleDestroy {
	constructor(
		@Inject(DB_POOL) private readonly conn: ReturnType<typeof createDb>,
	) {}

	async onModuleDestroy() {
		await this.conn.pool.end();
	}
}
