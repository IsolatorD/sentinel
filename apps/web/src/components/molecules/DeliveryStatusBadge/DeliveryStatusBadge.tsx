import type { DeliveryStatus } from "@sentinel/shared";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/atoms/Badge/Badge";
import { TONES } from "@/components/molecules/DeliveryStatusBadge/DeliveryStatusBadge.constants";

export function DeliveryStatusBadge({ status }: { status: DeliveryStatus }) {
	const { t } = useTranslation();
	return (
		<Badge tone={TONES[status]}>{t(`alerts.history.status.${status}`)}</Badge>
	);
}
