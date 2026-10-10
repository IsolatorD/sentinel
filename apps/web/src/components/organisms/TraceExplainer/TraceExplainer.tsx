import { ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/atoms/Badge/Badge";
import {
	ITEMS,
	NODES,
} from "@/components/organisms/TraceExplainer/TraceExplainer.constants";

/** Explica con un esquema cómo una misma petición se sigue del navegador al backend. */
export function TraceExplainer() {
	const { t } = useTranslation();
	return (
		<section
			id="traces"
			className="scroll-mt-20 border-b border-border bg-subtle/60 py-20"
		>
			<div className="mx-auto w-full max-w-6xl px-6">
				<div className="mx-auto max-w-2xl text-center">
					<h2 className="text-3xl font-semibold tracking-tight text-balance">
						{t("landing.traces.title")}
					</h2>
					<p className="mt-3 text-muted text-balance">
						{t("landing.traces.subtitle")}
					</p>
				</div>

				<div className="mt-12 rounded-xl border border-border bg-surface p-6 shadow-sm">
					<ol className="flex flex-col items-stretch gap-3 md:flex-row md:items-center">
						{NODES.map(({ id, icon: Icon }, index) => (
							<li key={id} className="flex min-w-0 flex-1 items-center gap-3">
								<div className="min-w-0 flex-1 rounded-lg border border-border bg-background p-4">
									<div className="flex items-center gap-2">
										<Icon aria-hidden className="size-4 text-primary" />
										<span className="text-sm font-semibold">
											{t(`landing.traces.nodes.${id}.title`)}
										</span>
									</div>
									<p className="mt-1.5 text-xs text-muted">
										{t(`landing.traces.nodes.${id}.body`)}
									</p>
									<code className="mt-3 block truncate rounded bg-subtle px-2 py-1 font-mono text-[11px] text-muted">
										{t(`landing.traces.nodes.${id}.code`)}
									</code>
								</div>
								{index < NODES.length - 1 && (
									<ArrowRight
										aria-hidden
										className="hidden size-5 shrink-0 text-faint md:block"
									/>
								)}
							</li>
						))}
					</ol>
					<div className="mt-5 flex flex-wrap items-center gap-2 border-t border-border pt-4 text-sm text-muted">
						<Badge tone="primary">trace_id</Badge>
						<span>{t("landing.traces.note")}</span>
					</div>
				</div>

				<ul className="mt-8 grid gap-4 md:grid-cols-3">
					{ITEMS.map((item) => (
						<li
							key={item}
							className="rounded-xl border border-border bg-surface p-5"
						>
							<h3 className="text-sm font-semibold">
								{t(`landing.traces.items.${item}.title`)}
							</h3>
							<p className="mt-1.5 text-sm text-muted">
								{t(`landing.traces.items.${item}.body`)}
							</p>
						</li>
					))}
				</ul>
			</div>
		</section>
	);
}
