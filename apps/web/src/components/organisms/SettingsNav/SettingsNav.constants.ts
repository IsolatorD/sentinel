import {
	Gauge,
	KeyRound,
	type LucideIcon,
	Plug,
	SlidersHorizontal,
	TriangleAlert,
} from "lucide-react";
import type { SettingsSearch } from "@/utils/searchParams/searchParamsInterface";

/** Entradas del menú lateral de la configuración (`settings.nav.<id>`). */
export const SETTINGS_NAV: Array<{
	id: SettingsSearch["section"];
	icon: LucideIcon;
}> = [
	{ id: "general", icon: SlidersHorizontal },
	{ id: "keys", icon: KeyRound },
	{ id: "limits", icon: Gauge },
	{ id: "integrations", icon: Plug },
	{ id: "danger", icon: TriangleAlert },
];
