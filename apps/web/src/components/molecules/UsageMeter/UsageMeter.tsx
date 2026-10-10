import { useTranslation } from "react-i18next";
import { WARN_AT } from "@/components/molecules/UsageMeter/UsageMeter.constants";
import type { UsageMeterProps } from "@/components/molecules/UsageMeter/UsageMeterInterface";
import { cn } from "@/utils/cn/cn";

/** Lo consumido este mes y, si hay límite, cuánto falta: la barra pasa a ámbar al 80 % y a rojo al llegar. */
export function UsageMeter({ label, used, quota }: UsageMeterProps) {
	const { t, i18n } = useTranslation();
	const format = (n: number) => new Intl.NumberFormat(i18n.language).format(n);
	const ratio = quota ? used / quota : 0;
	const exceeded = quota !== null && used >= quota;

	return (
		<div
			data-testid="usage-meter"
			data-state={exceeded ? "exceeded" : ratio >= WARN_AT ? "warning" : "ok"}
		>
			<div className="flex items-baseline justify-between gap-3 text-sm">
				<span className="font-medium text-foreground">{label}</span>
				<span className="tabular-nums text-muted">
					{quota === null
						? t("settings.limits.usedNoLimit", { used: format(used) })
						: t("settings.limits.usedOfQuota", {
								used: format(used),
								quota: format(quota),
							})}
				</span>
			</div>
			{quota !== null && (
				<div
					role="progressbar"
					aria-label={label}
					aria-valuemin={0}
					aria-valuemax={quota}
					aria-valuenow={Math.min(used, quota)}
					className="mt-1.5 h-2 overflow-hidden rounded-full bg-subtle"
				>
					<div
						className={cn(
							"h-full rounded-full transition-all",
							exceeded
								? "bg-danger"
								: ratio >= WARN_AT
									? "bg-warning"
									: "bg-success",
						)}
						style={{ width: `${Math.min(100, ratio * 100)}%` }}
					/>
				</div>
			)}
		</div>
	);
}
