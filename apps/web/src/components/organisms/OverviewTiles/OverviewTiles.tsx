import { useTranslation } from "react-i18next";
import { StatTile } from "@/components/molecules/StatTile/StatTile";
import type { OverviewTilesProps } from "@/components/organisms/OverviewTiles/OverviewTilesInterface";
import { changePercent } from "@/utils/changePercent/changePercent";
import { formatMs, formatPercent } from "@/utils/performance/performance";
import { formatCompact } from "@/utils/time/time";

/** Los números del periodo, cada uno con lo que cambió respecto al periodo anterior de igual duración. */
export function OverviewTiles({ data }: OverviewTilesProps) {
	const { t, i18n } = useTranslation();
	const { totals, previous } = data;
	const n = (value: number) => formatCompact(value, i18n.language);
	return (
		<div
			className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7"
			data-testid="overview-tiles"
		>
			<StatTile
				label={t("overview.tiles.events")}
				change={changePercent(totals.events, previous.events)}
				upIsBad
			>
				{n(totals.events)}
			</StatTile>
			<StatTile label={t("overview.tiles.users")}>{n(totals.users)}</StatTile>
			<StatTile
				label={t("overview.tiles.newIssues")}
				change={changePercent(totals.newIssues, previous.newIssues)}
				upIsBad
			>
				{n(totals.newIssues)}
			</StatTile>
			<StatTile label={t("overview.tiles.resolved")}>
				{n(totals.resolvedIssues)}
			</StatTile>
			<StatTile
				label={t("overview.tiles.transactions")}
				change={changePercent(totals.transactions, previous.transactions)}
			>
				{n(totals.transactions)}
			</StatTile>
			<StatTile label={t("overview.tiles.p95")}>
				{formatMs(totals.p95, i18n.language)}
			</StatTile>
			<StatTile label={t("overview.tiles.errorRate")}>
				{formatPercent(totals.errorRate, i18n.language)}
			</StatTile>
		</div>
	);
}
