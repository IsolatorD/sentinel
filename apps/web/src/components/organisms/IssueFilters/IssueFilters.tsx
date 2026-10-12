import { ISSUE_SORTS } from "@sentinel/shared";
import { ArrowDownWideNarrow, ArrowUpNarrowWide } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/atoms/Button/Button";
import { Select } from "@/components/atoms/Select/Select";
import { SearchInput } from "@/components/molecules/SearchInput/SearchInput";
import {
	SEARCH_DELAY_MS,
	TABS,
	withCurrent,
} from "@/components/organisms/IssueFilters/IssueFilters.constants";
import { useMembers } from "@/hooks/useOrganizations/useOrganizations";
import { useEnvironments, useReleases } from "@/hooks/useReleases/useReleases";
import { useCurrentProject } from "@/hooks/useScope/useScope";
import { useIssuesSearch } from "@/hooks/useSearchParams/useSearchParams";
import { cn } from "@/utils/cn/cn";

export function IssueFilters() {
	const { t } = useTranslation();
	const { search, update } = useIssuesSearch();
	const { scope, organization } = useCurrentProject();
	const environments = useEnvironments(scope);
	const releases = useReleases(scope);
	const members = useMembers(organization?.id);

	// El texto se escribe en un estado local y se aplica a la URL con retraso. El retraso vive en
	// el manejador de escritura (no en un efecto): así un cambio externo de la URL —limpiar filtros,
	// el botón "atrás"— nunca se pisa con un valor viejo que quedó pendiente.
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

	// La URL cambió desde fuera: el campo la sigue y se descarta lo que estuviera pendiente.
	useEffect(() => {
		clearTimeout(pending.current);
		setText(search.q ?? "");
	}, [search.q]);
	useEffect(() => () => clearTimeout(pending.current), []);

	return (
		<div
			className="space-y-3"
			data-testid="issue-filters"
			data-tour="issue-filters"
		>
			<div className="flex flex-wrap items-center gap-3">
				<div
					role="tablist"
					aria-label={t("issues.title")}
					className="flex rounded-md border border-border-strong bg-surface p-0.5 shadow-sm"
				>
					{TABS.map((tab) => (
						<button
							key={tab}
							type="button"
							role="tab"
							aria-selected={search.status === tab}
							onClick={() => update({ status: tab }, { resetPage: true })}
							className={cn(
								"rounded px-3 py-1 text-xs font-medium transition-colors",
								search.status === tab
									? "bg-primary text-white"
									: "text-muted hover:bg-subtle hover:text-foreground",
							)}
						>
							{t(`issues.tabs.${tab}`)}
						</button>
					))}
				</div>
				<SearchInput
					value={text}
					onChange={onSearchChange}
					placeholder={t("issues.searchPlaceholder")}
					aria-label={t("issues.searchPlaceholder")}
					clearLabel={t("common.close")}
					className="min-w-56 flex-1 sm:max-w-sm"
				/>
			</div>
			{/* Los cuatro filtros comparten rejilla: mismo ancho y alineados, tanto en móvil (2 por fila) como en escritorio (1 fila). */}
			<div className="grid grid-cols-2 gap-3 lg:grid-cols-[repeat(3,minmax(0,1fr))_minmax(0,1.5fr)]">
				{/* Si el filtro de la URL ya no existe en las listas (p. ej. release borrada), se conserva como opción. */}
				<Select
					aria-label={t("issues.filters.environment")}
					value={search.environment ?? ""}
					onChange={(e) =>
						update(
							{ environment: e.target.value || undefined },
							{ resetPage: true },
						)
					}
					className="w-full"
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
						update(
							{ release: e.target.value || undefined },
							{ resetPage: true },
						)
					}
					className="w-full"
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
				<Select
					aria-label={t("issues.filters.assignee")}
					value={search.assignee ?? ""}
					onChange={(e) =>
						update(
							{ assignee: e.target.value || undefined },
							{ resetPage: true },
						)
					}
					className="w-full"
				>
					<option value="">{t("issues.filters.allAssignees")}</option>
					<option value="me">{t("issues.filters.assignedToMe")}</option>
					<option value="unassigned">{t("issues.filters.unassigned")}</option>
					{(members.data ?? []).map((m) => (
						<option key={m.userId} value={m.userId}>
							{m.user.name}
						</option>
					))}
				</Select>
				<div className="flex items-center gap-2">
					<Select
						aria-label={t("issues.sort.label")}
						value={search.sort}
						onChange={(e) =>
							update(
								{ sort: e.target.value as (typeof ISSUE_SORTS)[number] },
								{ resetPage: true },
							)
						}
						className="min-w-0 flex-1"
					>
						{ISSUE_SORTS.map((sort) => (
							<option key={sort} value={sort}>
								{t(`issues.sort.${sort}`)}
							</option>
						))}
					</Select>
					<Button
						size="icon"
						aria-label={
							search.order === "desc"
								? t("issues.sort.desc")
								: t("issues.sort.asc")
						}
						onClick={() =>
							update(
								{ order: search.order === "desc" ? "asc" : "desc" },
								{ resetPage: true },
							)
						}
					>
						{search.order === "desc" ? (
							<ArrowDownWideNarrow className="size-4" />
						) : (
							<ArrowUpNarrowWide className="size-4" />
						)}
					</Button>
				</div>
			</div>
		</div>
	);
}
