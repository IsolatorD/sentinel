import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	Param,
	ParseUUIDPipe,
	Post,
	UseGuards,
} from "@nestjs/common";
import {
	ApiBody,
	ApiCreatedResponse,
	ApiDefaultResponse,
	ApiNoContentResponse,
	ApiOkResponse,
	ApiOperation,
	ApiSecurity,
	ApiTags,
} from "@nestjs/swagger";
import { type CreateTokenInput, createTokenSchema } from "@sentinel/shared";
import { AuthGuard, type AuthSession } from "../auth/auth.guard.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { Notice } from "../common/notice.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { docs } from "../openapi/schemas.js";
import { TokensService } from "./tokens.service.js";

type User = AuthSession["user"];

@ApiTags("Tokens")
@ApiSecurity("session")
@ApiDefaultResponse({
	description: "Error (requiere rol owner o admin)",
	schema: docs.error,
})
@Controller("organizations/:orgId/tokens")
@UseGuards(AuthGuard)
export class TokensController {
	constructor(private readonly tokens: TokensService) {}

	@Get()
	@ApiOperation({
		summary: "Lista los tokens de API de la organización (sin su valor)",
	})
	@ApiOkResponse({ schema: docs.tokenList })
	list(@CurrentUser() user: User, @Param("orgId") orgId: string) {
		return this.tokens.list(user.id, orgId);
	}

	@Post()
	@ApiOperation({
		summary: "Crea un token de API",
		description:
			"Sirve para subir source maps desde el CI (`Authorization: Bearer <token>`). El valor completo solo se devuelve en esta respuesta.",
	})
	@ApiBody({ schema: docs.createToken })
	@ApiCreatedResponse({ schema: docs.createdToken })
	@Notice({ code: "NOTICE_TOKEN_CREATED" })
	create(
		@CurrentUser() user: User,
		@Param("orgId") orgId: string,
		@Body(new ZodValidationPipe(createTokenSchema)) body: CreateTokenInput,
	) {
		return this.tokens.create(user.id, orgId, body.name);
	}

	@Delete(":tokenId")
	@HttpCode(204)
	@ApiOperation({ summary: "Revoca un token de API" })
	@ApiNoContentResponse()
	@Notice({ code: "NOTICE_TOKEN_REVOKED" })
	async revoke(
		@CurrentUser() user: User,
		@Param("orgId") orgId: string,
		@Param("tokenId", ParseUUIDPipe) tokenId: string,
	) {
		await this.tokens.revoke(user.id, orgId, tokenId);
	}
}
