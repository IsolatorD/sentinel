import { ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/atoms/Badge/Badge";
import { CodeBlock } from "@/components/molecules/CodeBlock/CodeBlock";
import {
	FLOW,
	RUN_COMMANDS,
	STACK,
} from "@/components/organisms/ArchitectureSection/ArchitectureSection.constants";

export function ArchitectureSection() {
	const { t } = useTranslation();
	return (
		<section
			id="architecture"
			className="scroll-mt-20 border-b border-border py-20"
		>
			<div className="mx-auto w-full max-w-6xl px-6">
				<div className="mx-auto max-w-2xl text-center">
					<h2 className="text-3xl font-semibold tracking-tight text-balance">
						{t("landing.architecture.title")}
					</h2>
					<p className="mt-3 text-muted text-balance">
						{t("landing.architecture.subtitle")}
					</p>
				</div>

				<ol className="mt-12 grid gap-3 md:grid-cols-3 lg:grid-cols-6">
					{FLOW.map(({ id, icon: Icon }, index) => (
						<li key={id} className="relative">
							<div className="h-full rounded-xl border border-border bg-surface p-4">
								<Icon aria-hidden className="size-5 text-primary" />
								<h3 className="mt-3 text-sm font-semibold">
									{t(`landing.architecture.flow.${id}.title`)}
								</h3>
								<p className="mt-1 text-xs text-muted">
									{t(`landing.architecture.flow.${id}.body`)}
								</p>
							</div>
							{index < FLOW.length - 1 && (
								<ArrowRight
									aria-hidden
									className="absolute top-1/2 -right-3 z-10 hidden size-4 -translate-y-1/2 text-faint lg:block"
								/>
							)}
						</li>
					))}
				</ol>

				<div className="mt-12 grid gap-10 lg:grid-cols-2">
					<div className="min-w-0">
						<h3 className="text-sm font-semibold">
							{t("landing.architecture.stack")}
						</h3>
						<ul className="mt-3 flex flex-wrap gap-2">
							{STACK.map((item) => (
								<li key={item}>
									<Badge tone="neutral">{item}</Badge>
								</li>
							))}
						</ul>
						<p className="mt-5 text-sm text-muted">
							{t("landing.architecture.note")}
						</p>
					</div>
					<div className="min-w-0">
						<h3 className="mb-3 text-sm font-semibold">
							{t("landing.architecture.run")}
						</h3>
						<CodeBlock title="bash" code={RUN_COMMANDS} />
					</div>
				</div>
			</div>
		</section>
	);
}
