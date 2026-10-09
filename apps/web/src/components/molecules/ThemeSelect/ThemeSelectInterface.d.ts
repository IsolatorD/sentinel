import type { ThemePreference } from "@/utils/theme/themeInterface";

export interface ThemeSelectProps {
	value: ThemePreference;
	onChange: (theme: ThemePreference) => void;
	className?: string;
}
