import { useTranslation } from "react-i18next";
import { Badge } from "@/components/atoms/Badge";

type Tone = "fatal" | "danger" | "warning" | "info" | "neutral";

const TONES: Record<string, Tone> = {
	fatal: "fatal",
	error: "danger",
	warning: "warning",
	info: "info",
	debug: "neutral",
};

export function LevelBadge({ level }: { level: string }) {
	const { t } = useTranslation();
	const known =
		level === "fatal" ||
		level === "error" ||
		level === "warning" ||
		level === "info" ||
		level === "debug";
	return (
		<Badge tone={TONES[level] ?? "neutral"} data-level={level}>
			{known ? t(`issues.levels.${level}`) : level}
		</Badge>
	);
}
