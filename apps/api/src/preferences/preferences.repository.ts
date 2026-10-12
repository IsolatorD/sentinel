import { Inject, Injectable } from "@nestjs/common";
import { type Database, eq, userPreference } from "@sentinel/db";
import {
	isLocale,
	type Locale,
	type PreferencesDto,
	TOUR_IDS,
	type UpdatePreferencesInput,
} from "@sentinel/shared";
import { DB } from "../database/database.module.js";

const EMPTY: PreferencesDto = {
	locale: null,
	theme: null,
	toursSeen: [],
	emailOnAssign: true,
};

// Única capa que conoce Drizzle para las preferencias.
@Injectable()
export class PreferencesRepository {
	constructor(@Inject(DB) private readonly db: Database) {}

	async get(userId: string): Promise<PreferencesDto> {
		const [row] = await this.db
			.select()
			.from(userPreference)
			.where(eq(userPreference.userId, userId));
		return row ? toDto(row) : EMPTY;
	}

	/** Guarda solo lo que se envía; lo demás queda como estaba. */
	async update(
		userId: string,
		input: UpdatePreferencesInput,
	): Promise<PreferencesDto> {
		const values = {
			...(input.locale !== undefined && { locale: input.locale }),
			...(input.theme !== undefined && { theme: input.theme }),
			...(input.emailOnAssign !== undefined && {
				emailOnAssign: input.emailOnAssign,
			}),
			...(input.toursSeen !== undefined && {
				toursSeen: [...new Set(input.toursSeen)],
			}),
		};
		const [row] = await this.db
			.insert(userPreference)
			.values({ userId, ...values })
			.onConflictDoUpdate({
				target: userPreference.userId,
				set: { ...values, updatedAt: new Date() },
			})
			.returning();
		return toDto(row);
	}
}

function toDto(row: typeof userPreference.$inferSelect): PreferencesDto {
	return {
		locale: isLocale(row.locale) ? row.locale : null,
		theme:
			(["system", "light", "dark"] as const).find((t) => t === row.theme) ??
			null,
		toursSeen: row.toursSeen.filter(
			(t): t is PreferencesDto["toursSeen"][number] =>
				(TOUR_IDS as readonly string[]).includes(t),
		),
		emailOnAssign: row.emailOnAssign,
	};
}

export type { Locale };
