import type { Platform } from "@sentinel/shared";
import type { Method } from "@/components/organisms/InstallInstructions/InstallInstructionsInterface";

/** Cómo se instala según la plataforma: solo React y JavaScript tienen SDK; el resto usa la API. */
export const METHODS: Record<Platform, Method[]> = {
	javascript: ["npm", "script"],
	react: ["npm"],
	node: ["http"],
	"react-native": ["http"],
	python: ["http"],
	other: ["http"],
};
