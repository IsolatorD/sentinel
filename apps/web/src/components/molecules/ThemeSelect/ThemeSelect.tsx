import { useTranslation } from "react-i18next";
import { Select } from "@/components/atoms/Select/Select";
import type { ThemeSelectProps } from "@/components/molecules/ThemeSelect/ThemeSelectInterface";
import { isThemePreference } from "@/utils/theme/theme";
import { THEMES } from "@/utils/theme/theme.constants";

export function ThemeSelect({ value, onChange, className }: ThemeSelectProps) {
	const { t } = useTranslation();
	return (
		<Select
			aria-label={t("common.theme")}
			value={value}
			onChange={(e) => {
				if (isThemePreference(e.target.value)) onChange(e.target.value);
			}}
			className={className}
		>
			{THEMES.map((id) => (
				<option key={id} value={id}>
					{t(`common.themes.${id}`)}
				</option>
			))}
		</Select>
	);
}
