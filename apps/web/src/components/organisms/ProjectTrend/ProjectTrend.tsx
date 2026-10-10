import type { StatsPeriod } from "@sentinel/shared";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { TrendCard } from "@/components/molecules/TrendCard/TrendCard";
import { useCurrentProject } from "@/hooks/useScope/useScope";
import { useProjectStats } from "@/hooks/useStats/useStats";

export function ProjectTrend() {
	const { t } = useTranslation();
	const { scope } = useCurrentProject();
	const [period, setPeriod] = useState<StatsPeriod>("24h");
	const stats = useProjectStats(scope, period);
	return (
		<TrendCard
			title={t("trend.projectTitle")}
			period={period}
			onPeriodChange={setPeriod}
			stats={stats.data}
			isError={stats.isError}
			onRetry={() => stats.refetch()}
		/>
	);
}
