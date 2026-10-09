import { Menu as MenuIcon, X } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import { Logo } from "@/components/atoms/Logo/Logo";

/** Estructura de la app: barra lateral fija en escritorio y desplegable en móvil. */
export function AppShellTemplate({
	sidebar,
	children,
}: {
	sidebar: ReactNode;
	children: ReactNode;
}) {
	const { t } = useTranslation();
	const [open, setOpen] = useState(false);

	return (
		<div className="flex h-full">
			<aside className="hidden w-64 shrink-0 md:block">{sidebar}</aside>

			{open && (
				<div className="fixed inset-0 z-30 md:hidden">
					<button
						type="button"
						aria-label={t("common.close")}
						className="absolute inset-0 animate-fade-in bg-black/40"
						onClick={() => setOpen(false)}
					/>
					<aside className="absolute inset-y-0 left-0 w-64 animate-slide-in-left shadow-xl">
						{sidebar}
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
