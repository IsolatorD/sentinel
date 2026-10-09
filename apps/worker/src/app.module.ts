import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { EventsModule } from "./events/events.module.js";

@Module({
	imports: [
		ConfigModule.forRoot({ isGlobal: true, envFilePath: ["../../.env"] }),
		BullModule.forRootAsync({
			inject: [ConfigService],
			useFactory: (config: ConfigService) => ({
				connection: {
					host: config.get<string>("REDIS_HOST", "localhost"),
					port: config.get<number>("REDIS_PORT", 6379),
				},
			}),
		}),
		EventsModule,
	],
})
export class AppModule {}
