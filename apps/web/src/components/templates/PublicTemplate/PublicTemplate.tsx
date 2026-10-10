import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { buttonVariants } from "@/components/atoms/Button/Button.constants";
import { Logo } from "@/components/atoms/Logo/Logo";
import { LanguageSelect } from "@/components/molecules/LanguageSelect/LanguageSelect";
import { ThemeSelect } from "@/components/molecules/ThemeSelect/ThemeSelect";
import { SECTIONS } from "@/components/templates/PublicTemplate/PublicTemplate.constants";
import type { PublicTemplateProps } from "@/components/templates/PublicTemplate/PublicTemplateInterface";
import { useSession } from "@/hooks/useSession/useSession";
import { useTheme } from "@/hooks/useTheme/useTheme";
import { cn } from "@/utils/cn/cn";
import { API_DOCS_URL } from "@/utils/publicLinks/publicLinks.constants";

/** Marco de las páginas públicas (landing y documentación): barra superior y pie. */
export function PublicTemplate({ children, active }: PublicTemplateProps) {
	const { t } = useTranslation();
	const { theme, setTheme } = useTheme();
	const session = useSession();
	const signedIn = Boolean(session.data);

	return (
		<div className="flex min-h-full flex-col bg-background text-foreground">
			<header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
				<div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-4 px-6">
					<Link to="/" aria-label="Sentinel" className="text-foreground">
						<Logo markClassName="text-primary" />
					</Link>
					<nav
						aria-label={t("public.nav.label")}
						className="ml-4 hidden items-center gap-1 md:flex"
					>
						{SECTIONS.map((section) => (
							<Link
								key={section}
								to="/"
								hash={section}
								className="rounded-md px-2.5 py-1.5 text-sm text-muted hover:bg-subtle hover:text-foreground"
							>
								{t(`public.nav.${section}`)}
							</Link>
						))}
						<Link
							to="/docs"
							className={cn(
								"rounded-md px-2.5 py-1.5 text-sm hover:bg-subtle hover:text-foreground",
								active === "docs"
									? "font-medium text-foreground"
									: "text-muted",
							)}
						>
							{t("public.nav.docs")}
						</Link>
					</nav>
					<div className="ml-auto flex items-center gap-2">
						<ThemeSelect
							value={theme}
							onChange={setTheme}
							className="hidden w-28 lg:inline-flex"
						/>
						<LanguageSelect className="hidden w-28 lg:inline-flex" />
						{signedIn ? (
							<Link to="/" className={buttonVariants({ variant: "primary" })}>
								{t("public.openApp")}
							</Link>
						) : (
							<>
								<Link
									to="/login"
									className={cn(
										buttonVariants({ variant: "ghost" }),
										"hidden sm:inline-flex",
									)}
								>
									{t("public.signIn")}
								</Link>
								<Link
									to="/register"
									className={buttonVariants({ variant: "primary" })}
								>
									{t("public.signUp")}
								</Link>
							</>
						)}
					</div>
				</div>
			</header>

			<main className="flex-1">{children}</main>

			<footer className="border-t border-border bg-subtle/60">
				<div className="mx-auto grid w-full max-w-6xl gap-8 px-6 py-10 sm:grid-cols-[2fr_1fr_1fr]">
					<div>
						<Logo markClassName="text-primary" />
						<p className="mt-3 max-w-sm text-sm text-muted">
							{t("public.footer.tagline")}
						</p>
					</div>
					<div>
						<h2 className="text-xs font-semibold tracking-wide text-faint uppercase">
							{t("public.footer.product")}
						</h2>
						<ul className="mt-3 space-y-2 text-sm">
							<li>
								<Link to="/docs" className="text-muted hover:text-foreground">
									{t("public.nav.docs")}
								</Link>
							</li>
							<li>
								<a
									href={API_DOCS_URL}
									className="text-muted hover:text-foreground"
								>
									{t("public.footer.api")}
								</a>
							</li>
							<li>
								<Link to="/login" className="text-muted hover:text-foreground">
									{t("public.signIn")}
								</Link>
							</li>
						</ul>
					</div>
					<div>
						<h2 className="text-xs font-semibold tracking-wide text-faint uppercase">
							{t("public.footer.built")}
						</h2>
						<p className="mt-3 text-sm text-muted">
							{t("public.footer.stack")}
						</p>
						{/* En pantallas estrechas la barra no tiene sitio para estos selectores. */}
						<div className="mt-4 flex gap-2 lg:hidden">
							<ThemeSelect value={theme} onChange={setTheme} className="w-28" />
							<LanguageSelect className="w-28" />
						</div>
					</div>
				</div>
				<div className="border-t border-border py-4 text-center text-xs text-faint">
					© Sentinel
				</div>
			</footer>
		</div>
	);
}
