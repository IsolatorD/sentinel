import { Check } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CodeBlock } from "@/components/molecules/CodeBlock/CodeBlock";
import { TabBar } from "@/components/molecules/TabBar/TabBar";
import {
	POINTS,
	SDKS,
} from "@/components/organisms/SdkShowcase/SdkShowcase.constants";

export function SdkShowcase() {
	const { t } = useTranslation();
	const [active, setActive] =
		useState<(typeof SDKS)[number]["id"]>("javascript");
	const sdk = SDKS.find((s) => s.id === active) ?? SDKS[0];

	return (
		<section id="sdks" className="scroll-mt-20 border-b border-border py-20">
			<div className="mx-auto w-full max-w-6xl px-6">
				<div className="mx-auto max-w-2xl text-center">
					<h2 className="text-3xl font-semibold tracking-tight text-balance">
						{t("landing.sdks.title")}
					</h2>
					<p className="mt-3 text-muted text-balance">
						{t("landing.sdks.subtitle")}
					</p>
				</div>
				<div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
					<div className="min-w-0">
						<div className="overflow-x-auto">
							<TabBar
								label={t("landing.sdks.title")}
								active={active}
								onChange={(id) => setActive(id as typeof active)}
								tabs={SDKS.map((s) => ({ id: s.id, label: s.label }))}
							/>
						</div>
						<div key={sdk.id} className="mt-6 animate-fade-in">
							<p className="text-xs font-medium tracking-wide text-faint uppercase">
								{sdk.language}
							</p>
							<p className="mt-2 text-muted">
								{t(`landing.sdks.${sdk.id}.summary`)}
							</p>
							<ul className="mt-4 space-y-2">
								{POINTS.map((point) => (
									<li key={point} className="flex items-start gap-2 text-sm">
										<Check
											aria-hidden
											className="mt-0.5 size-4 shrink-0 text-success"
										/>
										<span>{t(`landing.sdks.${sdk.id}.points.${point}`)}</span>
									</li>
								))}
							</ul>
						</div>
					</div>
					<div
						key={`${sdk.id}-code`}
						className="min-w-0 animate-fade-in space-y-3"
						data-testid="sdk-snippet"
					>
						<CodeBlock
							title={t("settings.install.install")}
							code={sdk.snippet.install}
						/>
						<CodeBlock
							title={t("settings.install.configure")}
							code={sdk.snippet.code}
						/>
					</div>
				</div>
			</div>
		</section>
	);
}
