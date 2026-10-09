import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { OrganizationsModule } from "../organizations/organizations.module.js";
import { TokensController } from "./tokens.controller.js";
import { TokensRepository } from "./tokens.repository.js";
import { TokensService } from "./tokens.service.js";

@Module({
	imports: [AuthModule, OrganizationsModule],
	controllers: [TokensController],
	providers: [TokensRepository, TokensService],
	exports: [TokensService],
})
export class TokensModule {}
