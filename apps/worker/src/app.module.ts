import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { LoggerModule } from "nestjs-pino";
import { validateWorkerEnv, type WorkerEnv } from "./config/env.js";
import { DatabaseModule } from "./database/database.module.js";
import { EventsModule } from "./events/events.module.js";
import { MailModule } from "./mail/mail.module.js";
import { TransactionsModule } from "./transactions/transactions.module.js";

@Module({
	imports: [
		ConfigModule.forRoot({
			isGlobal: true,
			envFilePath: ["../../.env"],
			validate: validateWorkerEnv,
		}),
		LoggerModule.forRootAsync({
			inject: [ConfigService],
			useFactory: (config: ConfigService<WorkerEnv, true>) => ({
				pinoHttp: {
					level: config.get("LOG_LEVEL", { infer: true }),
					transport:
						config.get("NODE_ENV", { infer: true }) === "development"
							? {
									target: "pino-pretty",
									options: { singleLine: true, colorize: true },
								}
							: undefined,
				},
			}),
		}),
		BullModule.forRootAsync({
			inject: [ConfigService],
			useFactory: (config: ConfigService<WorkerEnv, true>) => ({
				connection: {
					host: config.get("REDIS_HOST", { infer: true }),
					port: config.get("REDIS_PORT", { infer: true }),
					db: config.get("REDIS_DB", { infer: true }),
				},
			}),
		}),
		DatabaseModule,
		EventsModule,
		MailModule,
		TransactionsModule,
	],
})
export class AppModule {}
