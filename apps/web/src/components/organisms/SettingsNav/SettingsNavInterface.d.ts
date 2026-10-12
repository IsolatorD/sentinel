import type { SettingsSearch } from "@/utils/searchParams/searchParamsInterface";

export interface SettingsNavProps {
	current: SettingsSearch["section"];
	onSelect: (section: SettingsSearch["section"]) => void;
}
