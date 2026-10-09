import { publicConfigSchema } from "@sentinel/shared";
import { http } from "@/services/http/http";

export const configService = {
	getPublicConfig: () => http("/api/config", { schema: publicConfigSchema }),
};
