import { Body, Controller, Get, Patch, UseGuards } from "@nestjs/common";
import {
	ApiBody,
	ApiDefaultResponse,
	ApiOkResponse,
	ApiOperation,
	ApiSecurity,
	ApiTags,
} from "@nestjs/swagger";
import {
	type UpdatePreferencesInput,
	updatePreferencesSchema,
} from "@sentinel/shared";
import { AuthGuard, type AuthSession } from "../auth/auth.guard.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { docs } from "../openapi/schemas.js";
import { PreferencesRepository } from "./preferences.repository.js";

type User = AuthSession["user"];

@ApiTags("Preferences")
@ApiSecurity("session")
@ApiDefaultResponse({ description: "Error", schema: docs.error })
@Controller("me/preferences")
@UseGuards(AuthGuard)
export class PreferencesController {
	constructor(private readonly preferences: PreferencesRepository) {}

	@Get()
	@ApiOperation({
		summary: "Preferencias de la persona autenticada",
		description:
			"Idioma, tema y recorridos guiados vistos. El idioma decide en cuál se le escriben los correos.",
	})
	@ApiOkResponse({ schema: docs.preferences })
	get(@CurrentUser() user: User) {
		return this.preferences.get(user.id);
	}

	@Patch()
	@ApiOperation({ summary: "Cambia sus preferencias (solo lo que se envía)" })
	@ApiBody({ schema: docs.updatePreferences })
	@ApiOkResponse({ schema: docs.preferences })
	update(
		@CurrentUser() user: User,
		@Body(new ZodValidationPipe(updatePreferencesSchema))
		body: UpdatePreferencesInput,
	) {
		return this.preferences.update(user.id, body);
	}
}
