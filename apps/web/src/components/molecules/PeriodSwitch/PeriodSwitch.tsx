import { STATS_PERIODS } from "@sentinel/shared";
import { useTranslation } from "react-i18next";
import type { PeriodSwitchProps } from "@/components/molecules/PeriodSwitch/PeriodSwitchInterface";
import { cn } from "@/utils/cn/cn";

export function PeriodSwitch({ value, onChange }: PeriodSwitchProps) {
	const { t } = useTranslation();
	return (
		<fieldset
			aria-label={t("trend.period.label")}
			className="m-0 inline-flex min-w-0 rounded-md border border-border bg-subtle p-0.5"
		>
			{STATS_PERIODS.map((period) => (
				<button
					key={period}
					type="button"
					aria-pressed={value === period}
					onClick={() => onChange(period)}
					className={cn(
						"rounded px-2.5 py-1 text-xs font-medium transition-colors",
						value === period
							? "bg-surface text-foreground shadow-sm"
							: "text-muted hover:text-foreground",
					)}
				>
					{t(`trend.period.${period}`)}
				</button>
			))}
		</fieldset>
	);
}
