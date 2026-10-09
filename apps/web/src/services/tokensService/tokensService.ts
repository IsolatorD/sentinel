import {
	apiTokenListDtoSchema,
	createdApiTokenDtoSchema,
} from "@sentinel/shared";
import { http } from "@/services/http/http";
import { base } from "@/services/tokensService/tokensService.constants";

export const tokensService = {
	list: (orgId: string) => http(base(orgId), { schema: apiTokenListDtoSchema }),

	create: (orgId: string, name: string) =>
		http(base(orgId), {
			method: "POST",
			body: { name },
			schema: createdApiTokenDtoSchema,
		}),

	revoke: (orgId: string, tokenId: string) =>
		http(`${base(orgId)}/${tokenId}`, { method: "DELETE" }),
};
