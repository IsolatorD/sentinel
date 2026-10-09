import { Injectable, NotFoundException } from "@nestjs/common";
import type { ApiTokenDto, CreatedApiTokenDto } from "@sentinel/shared";
import { OrgAccessService } from "../organizations/org-access.service.js";
import { generateToken, hashToken, looksLikeToken } from "./domain/token.js";
import { type ApiTokenRow, TokensRepository } from "./tokens.repository.js";

const toDto = (row: ApiTokenRow): ApiTokenDto => ({
	id: row.id,
	name: row.name,
	prefix: row.tokenPrefix,
	createdAt: row.createdAt.toISOString(),
	lastUsedAt: row.lastUsedAt ? row.lastUsedAt.toISOString() : null,
});

@Injectable()
export class TokensService {
	constructor(
		private readonly tokens: TokensRepository,
		private readonly access: OrgAccessService,
	) {}

	async list(userId: string, orgId: string): Promise<ApiTokenDto[]> {
		await this.access.assert(userId, orgId, "admin");
		return (await this.tokens.list(orgId)).map(toDto);
	}

	async create(
		userId: string,
		orgId: string,
		name: string,
	): Promise<CreatedApiTokenDto> {
		await this.access.assert(userId, orgId, "admin");
		const generated = generateToken();
		const row = await this.tokens.insert({
			organizationId: orgId,
			name,
			tokenHash: generated.hash,
			tokenPrefix: generated.prefix,
			createdBy: userId,
		});
		return { ...toDto(row), token: generated.token };
	}

	async revoke(userId: string, orgId: string, tokenId: string): Promise<void> {
		await this.access.assert(userId, orgId, "admin");
		if (!(await this.tokens.delete(orgId, tokenId)))
			throw new NotFoundException({ reason: "TOKEN_NOT_FOUND" });
	}

	/** Organización a la que pertenece el token, o undefined si no es válido. */
	async authenticate(rawToken: string): Promise<string | undefined> {
		if (!looksLikeToken(rawToken)) return undefined;
		const row = await this.tokens.findByHash(hashToken(rawToken));
		if (!row) return undefined;
		await this.tokens.touch(row.id);
		return row.organizationId;
	}
}
