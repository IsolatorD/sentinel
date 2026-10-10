import type { DashboardDto } from "@sentinel/shared";

export interface SlowestCardProps {
	items: DashboardDto["slowest"];
	period: string;
}
