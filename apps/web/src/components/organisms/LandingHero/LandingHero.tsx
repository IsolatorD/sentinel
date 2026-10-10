import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { buttonVariants } from "@/components/atoms/Button/Button.constants";
import { ProductPreview } from "@/components/organisms/ProductPreview/ProductPreview";
import { useSession } from "@/hooks/useSession/useSession";

export function LandingHero() {
	const { t } = useTranslation();
	const signedIn = Boolean(useSession().data);
	return (
		<section className="relative overflow-hidden border-b border-border">
			<div
				aria-hidden
				className="pointer-events-none absolute -top-40 left-1/2 size-[42rem] -translate-x-1/2 rounded-full bg-primary/15 blur-3xl"
			/>
			<div className="relative mx-auto w-full max-w-6xl px-6 pt-16 pb-12 sm:pt-24">
				<div className="mx-auto max-w-3xl text-center">
					<span className="inline-flex items-center rounded-full border border-primary/25 bg-primary-soft px-3 py-1 text-xs font-medium text-primary">
						{t("landing.hero.badge")}
					</span>
					<h1 className="mt-5 text-4xl leading-tight font-semibold tracking-tight text-balance sm:text-5xl">
						{t("landing.hero.title")}
					</h1>
					<p className="mx-auto mt-5 max-w-2xl text-lg text-muted text-balance">
						{t("landing.hero.subtitle")}
					</p>
					<div className="mt-8 flex flex-wrap items-center justify-center gap-3">
						<Link
							to={signedIn ? "/" : "/register"}
							className={buttonVariants({ variant: "primary", size: "lg" })}
						>
							{signedIn ? t("public.openApp") : t("landing.hero.cta")}
							<ArrowRight aria-hidden className="size-4" />
						</Link>
						<Link
							to="/docs"
							className={buttonVariants({ variant: "secondary", size: "lg" })}
						>
							{t("landing.hero.docs")}
						</Link>
					</div>
					<p className="mt-4 text-xs text-faint">{t("landing.hero.note")}</p>
				</div>
				<div className="mt-14">
					<ProductPreview />
				</div>
			</div>
		</section>
	);
}
