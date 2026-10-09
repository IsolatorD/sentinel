import { publicConfigSchema } from "@sentinel/shared";
import { http } from "./http.js";

export const configService = {
	getPublicConfig: () => http("/api/config", { schema: publicConfigSchema }),
};
