import { Global, Inject, Module, type OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createDb } from "@sentinel/db";

export const DB = Symbol("DB");
const DB_CONNECTION = Symbol("DB_CONNECTION");

@Global()
@Module({
	providers: [
		{
			provide: DB_CONNECTION,
			inject: [ConfigService],
			useFactory: (config: ConfigService) =>
				createDb(config.getOrThrow<string>("DATABASE_URL")),
		},
		{
			provide: DB,
			inject: [DB_CONNECTION],
			useFactory: (conn: ReturnType<typeof createDb>) => conn.db,
		},
	],
	exports: [DB],
})
export class DatabaseModule implements OnModuleDestroy {
	constructor(
		@Inject(DB_CONNECTION) private readonly conn: ReturnType<typeof createDb>,
	) {}

	async onModuleDestroy() {
		await this.conn.pool.end();
	}
}
