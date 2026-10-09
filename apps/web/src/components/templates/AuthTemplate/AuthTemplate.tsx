import { useTranslation } from "react-i18next";
import { Logo } from "@/components/atoms/Logo/Logo";
import { LanguageSelect } from "@/components/molecules/LanguageSelect/LanguageSelect";
import type { AuthTemplateProps } from "@/components/templates/AuthTemplate/AuthTemplateInterface";

/** Pantalla de acceso: panel de marca a la izquierda y el formulario a la derecha. */
export function AuthTemplate({
	title,
	subtitle,
	children,
	footer,
	wide,
}: AuthTemplateProps) {
	const { t } = useTranslation();
	return (
		<div className="grid min-h-full lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
			<aside className="relative hidden flex-col justify-between overflow-hidden bg-sidebar p-10 text-white lg:flex">
				<Logo markClassName="size-8 text-primary" className="text-xl" />
				<div className="relative z-10 max-w-sm">
					<p className="text-3xl leading-tight font-semibold">
						{t("auth.brand.tagline")}
					</p>
					<p className="mt-3 text-sm text-sidebar-text">
						{t("auth.brand.description")}
					</p>
				</div>
				<div
					aria-hidden
					className="pointer-events-none absolute -right-24 -bottom-24 size-96 rounded-full bg-primary/25 blur-3xl"
				/>
				<p className="text-xs text-sidebar-muted">© Sentinel</p>
			</aside>
			<main className="flex flex-col px-6 py-8">
				<div className="flex justify-end">
					<LanguageSelect className="w-32" />
				</div>
				<div className="flex flex-1 items-center justify-center">
					<div className={wide ? "w-full max-w-2xl" : "w-full max-w-sm"}>
						<div className="mb-6 lg:hidden">
							<Logo markClassName="text-primary" />
						</div>
						<h1 className="text-2xl font-semibold text-foreground">{title}</h1>
						{subtitle && (
							<p className="mt-1 mb-6 text-sm text-muted">{subtitle}</p>
						)}
						{children}
						{footer && (
							<div className="mt-6 text-center text-sm text-muted">
								{footer}
							</div>
						)}
					</div>
				</div>
			</main>
		</div>
	);
}
