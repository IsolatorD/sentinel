import type { IssueStatus } from "@sentinel/shared";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/atoms/Badge";

const TONES = {
	unresolved: "neutral",
	resolved: "success",
	ignored: "neutral",
} as const;

export function StatusBadge({ status }: { status: IssueStatus }) {
	const { t } = useTranslation();
	return <Badge tone={TONES[status]}>{t(`issues.status.${status}`)}</Badge>;
}
