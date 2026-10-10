import { useTranslation } from "react-i18next";
import { DocsContent } from "@/components/organisms/DocsContent/DocsContent";
import { DOC_SECTIONS } from "@/components/organisms/DocsContent/DocsContent.constants";
import { PublicTemplate } from "@/components/templates/PublicTemplate/PublicTemplate";

/** `/docs`: la documentación de Sentinel, con un índice lateral que sigue a las secciones. */
export function DocsPage() {
	const { t } = useTranslation();
	return (
		<PublicTemplate active="docs">
			<div className="mx-auto w-full max-w-6xl px-6 py-12">
				<header className="max-w-2xl">
					<h1 className="text-4xl font-semibold tracking-tight">
						{t("docs.title")}
					</h1>
					<p className="mt-3 text-lg text-muted">{t("docs.subtitle")}</p>
				</header>
				<div className="mt-10 grid gap-10 lg:grid-cols-[12rem_minmax(0,1fr)]">
					<nav
						aria-label={t("docs.toc")}
						className="lg:sticky lg:top-20 lg:self-start"
					>
						<ul className="flex flex-wrap gap-2 lg:flex-col lg:gap-0.5">
							{DOC_SECTIONS.map((section) => (
								<li key={section}>
									<a
										href={`#${section}`}
										className="block rounded-md px-2.5 py-1.5 text-sm text-muted hover:bg-subtle hover:text-foreground"
									>
										{t(`docs.sections.${section}`)}
									</a>
								</li>
							))}
						</ul>
					</nav>
					<article className="min-w-0">
						<DocsContent />
					</article>
				</div>
			</div>
		</PublicTemplate>
	);
}
