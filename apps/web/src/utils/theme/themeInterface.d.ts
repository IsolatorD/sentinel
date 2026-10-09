import type { THEMES } from "@/utils/theme/theme.constants";

/** Lo que elige la persona: claro, oscuro o seguir al sistema. */
export type ThemePreference = (typeof THEMES)[number];

/** Lo que realmente se pinta. */
export type ResolvedTheme = "light" | "dark";
