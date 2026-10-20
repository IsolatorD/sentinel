import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { buttonVariants } from "@/components/atoms/Button/Button.constants";
import { useSession } from "@/hooks/useSession/useSession";
import { useSignUpEnabled } from "@/hooks/useSignUpEnabled/useSignUpEnabled";
import { API_DOCS_URL } from "@/utils/publicLinks/publicLinks.constants";

export function LandingCta() {
	const { t } = useTranslation();
	const signedIn = Boolean(useSession().data);
	const signUpEnabled = useSignUpEnabled();
	return (
		<section className="py-20">
			<div className="mx-auto w-full max-w-4xl px-6">
				<div className="relative overflow-hidden rounded-2xl bg-sidebar px-8 py-14 text-center text-white">
					<div
						aria-hidden
						className="pointer-events-none absolute -right-20 -bottom-24 size-80 rounded-full bg-primary/30 blur-3xl"
					/>
					<h2 className="relative text-3xl font-semibold tracking-tight text-balance">
						{t("landing.cta.title")}
					</h2>
					<p className="relative mx-auto mt-3 max-w-xl text-sidebar-text text-balance">
						{t("landing.cta.subtitle")}
					</p>
					<div className="relative mt-8 flex flex-wrap items-center justify-center gap-3">
						<Link
							to={signedIn ? "/" : signUpEnabled ? "/register" : "/login"}
							className={buttonVariants({ variant: "primary", size: "lg" })}
						>
							{signedIn
								? t("public.openApp")
								: signUpEnabled
									? t("landing.hero.cta")
									: t("public.signIn")}
						</Link>
						<Link
							to="/docs"
							className="inline-flex h-10 items-center rounded-md border border-white/25 px-5 text-sm font-medium text-white hover:bg-white/10"
						>
							{t("landing.hero.docs")}
						</Link>
						<a
							href={API_DOCS_URL}
							className="inline-flex h-10 items-center px-3 text-sm text-sidebar-text underline-offset-4 hover:text-white hover:underline"
						>
							{t("public.footer.api")}
						</a>
					</div>
				</div>
			</div>
		</section>
	);
}
