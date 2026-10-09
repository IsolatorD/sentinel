import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";
import { en } from "./locales/en";
import { es } from "./locales/es";

export const SUPPORTED_LANGUAGES = ["en", "es"] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];
export const LANGUAGE_STORAGE_KEY = "sentinel:lang";

i18n
	.use(LanguageDetector)
	.use(initReactI18next)
	.init({
		resources: { en: { translation: en }, es: { translation: es } },
		supportedLngs: SUPPORTED_LANGUAGES,
		// "es-AR" o "en-GB" usan el idioma base.
		nonExplicitSupportedLngs: true,
		load: "languageOnly",
		fallbackLng: "en",
		interpolation: { escapeValue: false }, // React ya escapa.
		detection: {
			order: ["localStorage", "navigator"],
			lookupLocalStorage: LANGUAGE_STORAGE_KEY,
			caches: ["localStorage"],
		},
	});

// Mantiene <html lang> sincronizado con el idioma activo (accesibilidad y SEO).
const syncLang = (lng: string) => {
	document.documentElement.lang = lng;
};
i18n.on("languageChanged", syncLang);
i18n.on("initialized", () => syncLang(i18n.language));

export default i18n;
