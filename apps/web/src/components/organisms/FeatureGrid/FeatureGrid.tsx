import { useTranslation } from "react-i18next";
import { FEATURES } from "@/components/organisms/FeatureGrid/FeatureGrid.constants";

export function FeatureGrid() {
	const { t } = useTranslation();
	return (
		<section
			id="features"
			className="scroll-mt-20 border-b border-border py-20"
		>
			<div className="mx-auto w-full max-w-6xl px-6">
				<div className="mx-auto max-w-2xl text-center">
					<h2 className="text-3xl font-semibold tracking-tight text-balance">
						{t("landing.features.title")}
					</h2>
					<p className="mt-3 text-muted text-balance">
						{t("landing.features.subtitle")}
					</p>
				</div>
				<ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
					{FEATURES.map(({ id, icon: Icon }) => (
						<li
							key={id}
							data-testid="feature"
							className="rounded-xl border border-border bg-surface p-5 shadow-sm"
						>
							<span className="inline-flex size-9 items-center justify-center rounded-lg bg-primary-soft text-primary">
								<Icon aria-hidden className="size-5" />
							</span>
							<h3 className="mt-4 text-base font-semibold">
								{t(`landing.features.${id}.title`)}
							</h3>
							<p className="mt-1.5 text-sm text-muted">
								{t(`landing.features.${id}.body`)}
							</p>
						</li>
					))}
				</ul>
			</div>
		</section>
	);
}
