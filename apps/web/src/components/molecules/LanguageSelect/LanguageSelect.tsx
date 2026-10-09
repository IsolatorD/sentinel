import { useTranslation } from "react-i18next";
import { Select } from "@/components/atoms/Select/Select";
import { NAMES } from "@/components/molecules/LanguageSelect/LanguageSelect.constants";
import { SUPPORTED_LANGUAGES } from "@/i18n";

export function LanguageSelect({
	className,
	onChange,
}: {
	className?: string;
	/** Se llama tras cambiar el idioma (p. ej. para guardarlo en el perfil). */
	onChange?: (language: string) => void;
}) {
	const { i18n, t } = useTranslation();
	const current =
		SUPPORTED_LANGUAGES.find((l) => i18n.language?.startsWith(l)) ?? "en";
	return (
		<Select
			aria-label={t("common.language")}
			value={current}
			onChange={(e) => {
				void i18n.changeLanguage(e.target.value);
				onChange?.(e.target.value);
			}}
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
