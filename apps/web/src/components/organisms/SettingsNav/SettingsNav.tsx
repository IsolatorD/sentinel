import { useTranslation } from "react-i18next";
import { SETTINGS_NAV } from "@/components/organisms/SettingsNav/SettingsNav.constants";
import type { SettingsNavProps } from "@/components/organisms/SettingsNav/SettingsNavInterface";
import { cn } from "@/utils/cn/cn";

/**
 * Menú de las secciones de la configuración: una columna a la izquierda en pantallas anchas y una
 * fila desplazable en las estrechas.
 */
export function SettingsNav({ current, onSelect }: SettingsNavProps) {
	const { t } = useTranslation();
	return (
		<nav
			aria-label={t("settings.nav.label")}
			className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 md:mx-0 md:w-52 md:shrink-0 md:flex-col md:overflow-visible md:px-0 md:pb-0"
			data-testid="settings-nav"
		>
			{SETTINGS_NAV.map(({ id, icon: Icon }) => {
				const active = id === current;
				return (
					<button
						key={id}
						type="button"
						aria-current={active ? "page" : undefined}
						onClick={() => onSelect(id)}
						className={cn(
							"flex shrink-0 items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm whitespace-nowrap transition-colors",
							active
								? "bg-subtle font-medium text-foreground"
								: "text-muted hover:bg-subtle hover:text-foreground",
							id === "danger" && !active && "hover:text-danger",
						)}
					>
						<Icon aria-hidden className="size-4 shrink-0" />
						{t(`settings.nav.${id}`)}
					</button>
				);
			})}
		</nav>
	);
}
