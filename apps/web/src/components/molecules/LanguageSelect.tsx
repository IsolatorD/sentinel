import { useTranslation } from "react-i18next";
import { Select } from "@/components/atoms/Select/Select";
import { SUPPORTED_LANGUAGES } from "@/i18n";

const NAMES: Record<string, string> = { en: "English", es: "Español" };

export function LanguageSelect({ className }: { className?: string }) {
	const { i18n, t } = useTranslation();
	const current =
		SUPPORTED_LANGUAGES.find((l) => i18n.language?.startsWith(l)) ?? "en";
	return (
		<Select
			aria-label={t("common.language")}
			value={current}
			onChange={(e) => i18n.changeLanguage(e.target.value)}
			className={className}
		>
			{SUPPORTED_LANGUAGES.map((lang) => (
				<option key={lang} value={lang}>
					{NAMES[lang]}
				</option>
			))}
		</Select>
	);
}
