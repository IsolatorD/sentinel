import type { StatsPeriod } from "@sentinel/shared";

export interface SamplesTableProps {
	name: string;
	period: StatsPeriod;
	environment?: string;
	release?: string;
	sort: "slowest" | "recent";
}
