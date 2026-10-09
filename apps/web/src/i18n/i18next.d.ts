import type { en } from "./locales/en";

// Claves de traducción tipadas: un error de tipeo en `t("…")` no compila.
declare module "i18next" {
	interface CustomTypeOptions {
		defaultNS: "translation";
		resources: { translation: typeof en };
	}
}
