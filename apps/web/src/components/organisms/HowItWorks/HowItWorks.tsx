import { useTranslation } from "react-i18next";
import { STEPS } from "@/components/organisms/HowItWorks/HowItWorks.constants";

export function HowItWorks() {
	const { t } = useTranslation();
	return (
		<section className="border-b border-border bg-subtle/60 py-20">
			<div className="mx-auto w-full max-w-6xl px-6">
				<h2 className="text-center text-3xl font-semibold tracking-tight">
					{t("landing.how.title")}
				</h2>
				<ol className="mt-12 grid gap-6 md:grid-cols-3">
					{STEPS.map((step, index) => (
						<li
							key={step}
							className="relative rounded-xl border border-border bg-surface p-6"
						>
							<span className="inline-flex size-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-white">
								{index + 1}
							</span>
							<h3 className="mt-4 text-base font-semibold">
								{t(`landing.how.${step}.title`)}
							</h3>
							<p className="mt-1.5 text-sm text-muted">
								{t(`landing.how.${step}.body`)}
							</p>
						</li>
					))}
				</ol>
			</div>
		</section>
	);
}
