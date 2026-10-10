import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/atoms/Card/Card";
import type { StatTileProps } from "@/components/molecules/StatTile/StatTileInterface";
import { cn } from "@/utils/cn/cn";

/** Un número grande con su etiqueta y, si se pasa, cuánto cambió respecto al periodo anterior. */
export function StatTile({
	label,
	children,
	change,
	upIsBad = false,
	hint,
}: StatTileProps) {
	const { t, i18n } = useTranslation();
	const direction =
		change === undefined || change === null || change === 0
			? "flat"
			: change > 0
				? "up"
				: "down";
	const bad =
		(direction === "up" && upIsBad) || (direction === "down" && !upIsBad);
	const Icon =
		direction === "up" ? ArrowUp : direction === "down" ? ArrowDown : Minus;

	return (
		<Card className="p-4" data-testid="stat-tile">
			<div className="text-[11px] font-medium tracking-wide text-faint uppercase">
				{label}
			</div>
			<div className="mt-1 text-2xl font-semibold text-foreground tabular-nums">
				{children}
			</div>
			{change !== undefined && (
				<div
					data-testid="stat-change"
					data-direction={direction}
					className={cn(
						"mt-1 inline-flex items-center gap-1 text-xs tabular-nums",
						direction === "flat"
							? "text-faint"
							: bad
								? "text-danger"
								: "text-success",
					)}
				>
					<Icon aria-hidden className="size-3" />
					{change === null
						? t("overview.noComparison")
						: t("overview.change", {
								value: new Intl.NumberFormat(i18n.language, {
									signDisplay: "exceptZero",
									maximumFractionDigits: 1,
								}).format(change),
							})}
				</div>
			)}
			{hint && <div className="mt-1 text-xs text-faint">{hint}</div>}
		</Card>
	);
}
