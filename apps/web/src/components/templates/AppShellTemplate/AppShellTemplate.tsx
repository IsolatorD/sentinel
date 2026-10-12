import { Menu as MenuIcon, X } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import { Logo } from "@/components/atoms/Logo/Logo";
import { useSidebarCollapsed } from "@/hooks/useSidebarCollapsed/useSidebarCollapsed";
import { cn } from "@/utils/cn/cn";

/** Estructura de la app: barra lateral fija en escritorio y desplegable en móvil. */
export function AppShellTemplate({
	sidebar,
	children,
}: {
	/** La barra lateral recibe si está en modo mini (solo escritorio) y cómo alternarlo. */
	sidebar: (props: {
		collapsed: boolean;
		onToggleCollapsed?: () => void;
	}) => ReactNode;
	children: ReactNode;
}) {
	const { t } = useTranslation();
	const [open, setOpen] = useState(false);
	const { collapsed, toggle } = useSidebarCollapsed();

	return (
		<div className="flex h-full">
			<aside
				className={cn(
					"hidden shrink-0 transition-[width] duration-200 md:block",
					collapsed ? "w-[4.5rem]" : "w-64",
				)}
				data-collapsed={collapsed}
			>
				{sidebar({ collapsed, onToggleCollapsed: toggle })}
			</aside>

			{open && (
				<div className="fixed inset-0 z-30 md:hidden">
					<button
						type="button"
						aria-label={t("common.close")}
						className="absolute inset-0 animate-fade-in bg-black/40"
						onClick={() => setOpen(false)}
					/>
					<aside className="absolute inset-y-0 left-0 w-64 animate-slide-in-left shadow-xl">
						{sidebar({ collapsed: false })}
					</aside>
				</div>
			)}

			<div className="flex min-w-0 flex-1 flex-col">
				<header className="flex items-center gap-3 border-b border-border bg-surface px-4 py-2 md:hidden">
					<button
						type="button"
						onClick={() => setOpen((v) => !v)}
						aria-label={t("common.menu")}
						className="rounded p-1 text-muted hover:bg-subtle"
					>
						{open ? <X className="size-5" /> : <MenuIcon className="size-5" />}
					</button>
					<Logo markClassName="size-6 text-primary" />
				</header>
				<main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
			</div>
		</div>
	);
}
