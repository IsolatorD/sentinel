import type { ReadyScope } from "@/hooks/useAlerts/useAlertsInterface";

export interface AlertDeliveriesTableProps {
	scope: ReadyScope;
	orgSlug: string;
	projectSlug: string;
	offset: number;
	onOffsetChange: (offset: number) => void;
}
