import type { StatsPeriod } from "@sentinel/shared";

export interface PeriodSwitchProps {
	value: StatsPeriod;
	onChange: (period: StatsPeriod) => void;
}
