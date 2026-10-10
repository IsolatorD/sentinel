import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Select } from "@/components/atoms/Select/Select";
import { PeriodSwitch } from "@/components/molecules/PeriodSwitch/PeriodSwitch";
import { SearchInput } from "@/components/molecules/SearchInput/SearchInput";
import {
	SEARCH_DELAY_MS,
	withCurrent,
} from "@/components/organisms/IssueFilters/IssueFilters.constants";
import { useEnvironments, useReleases } from "@/hooks/useReleases/useReleases";
import { useCurrentProject } from "@/hooks/useScope/useScope";
import { usePerformanceSearch } from "@/hooks/useSearchParams/useSearchParams";

/** Periodo, entorno, release y búsqueda por nombre de la lista de transacciones (todo en la URL). */
export function PerformanceFilters() {
	const { t } = useTranslation();
	const { search, update } = usePerformanceSearch();
	const { scope } = useCurrentProject();
	const environments = useEnvironments(scope);
	const releases = useReleases(scope);

	// Mismo patrón que el buscador de issues: el texto vive en local y se aplica a la URL con retraso.
	const [text, setText] = useState(search.q ?? "");
	const pending = useRef<ReturnType<typeof setTimeout>>(undefined);
	function onSearchChange(value: string) {
		setText(value);
		clearTimeout(pending.current);
		pending.current = setTimeout(
			() => update({ q: value.trim() || undefined }, { resetPage: true }),
			SEARCH_DELAY_MS,
		);
	}
	useEffect(() => {
		clearTimeout(pending.current);
		setText(search.q ?? "");
	}, [search.q]);
	useEffect(() => () => clearTimeout(pending.current), []);

	return (
		<div
			className="flex flex-wrap items-center gap-3"
			data-testid="performance-filters"
		>
			<PeriodSwitch
				value={search.period}
				onChange={(period) => update({ period }, { resetPage: true })}
			/>
			<SearchInput
				value={text}
				onChange={onSearchChange}
				placeholder={t("performance.filters.search")}
				aria-label={t("performance.filters.search")}
				clearLabel={t("common.close")}
				className="min-w-56 flex-1 sm:max-w-sm"
			/>
			<Select
				aria-label={t("issues.filters.environment")}
				value={search.environment ?? ""}
				onChange={(e) =>
					update(
						{ environment: e.target.value || undefined },
						{ resetPage: true },
					)
				}
				className="w-44"
			>
				<option value="">{t("issues.filters.allEnvironments")}</option>
				{withCurrent(environments.data, search.environment).map((env) => (
					<option key={env} value={env}>
						{env}
					</option>
				))}
			</Select>
			<Select
				aria-label={t("issues.filters.release")}
				value={search.release ?? ""}
				onChange={(e) =>
					update({ release: e.target.value || undefined }, { resetPage: true })
				}
				className="w-44"
			>
				<option value="">{t("issues.filters.allReleases")}</option>
				{withCurrent(
					releases.data?.map((r) => r.version),
					search.release,
				).map((version) => (
					<option key={version} value={version}>
						{version}
					</option>
				))}
			</Select>
		</div>
	);
}
