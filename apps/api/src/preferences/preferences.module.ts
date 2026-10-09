import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { PreferencesController } from "./preferences.controller.js";
import { PreferencesRepository } from "./preferences.repository.js";

@Module({
	imports: [AuthModule],
	controllers: [PreferencesController],
	providers: [PreferencesRepository],
})
export class PreferencesModule {}
