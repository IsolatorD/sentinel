import { useTranslation } from "react-i18next";
import { CodeBlock } from "@/components/molecules/CodeBlock/CodeBlock";
import { DocSection } from "@/components/organisms/DocsContent/DocSection/DocSection";
import {
	ALERT_CHANNELS,
	ALERT_RULES,
	ENDPOINTS,
	PACKAGES,
	QUICKSTART_STEPS,
	SOURCEMAPS_COMMAND,
	TRACING_BROWSER,
	TRACING_SERVER,
} from "@/components/organisms/DocsContent/DocsContent.constants";
import {
	POINTS,
	SDKS,
} from "@/components/organisms/SdkShowcase/SdkShowcase.constants";
import { httpSnippet } from "@/utils/installSnippets/installSnippets";
import {
	API_DOCS_URL,
	SAMPLE_DSN,
} from "@/utils/publicLinks/publicLinks.constants";

/** El contenido de `/docs`: de crear la cuenta a instalar un SDK, seguir una traza y alojarlo uno mismo. */
export function DocsContent() {
	const { t } = useTranslation();
	return (
		<div className="space-y-10" data-testid="docs-content">
			<DocSection
				id="quickstart"
				title={t("docs.sections.quickstart")}
				intro={t("docs.quickstart.intro")}
			>
				<ol className="space-y-3">
					{QUICKSTART_STEPS.map((step, index) => (
						<li key={step} className="flex gap-3">
							<span className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary">
								{index + 1}
							</span>
							<div>
								<div className="text-sm font-semibold">
									{t(`docs.quickstart.steps.${step}.title`)}
								</div>
								<p className="text-sm text-muted">
									{t(`docs.quickstart.steps.${step}.body`)}
								</p>
							</div>
						</li>
					))}
				</ol>
			</DocSection>

			<DocSection
				id="sdks"
				title={t("docs.sections.sdks")}
				intro={t("docs.sdks.intro")}
			>
				<div className="overflow-x-auto rounded-lg border border-border">
					<table className="w-full text-left text-sm">
						<thead className="bg-subtle/70 text-[11px] tracking-wide text-faint uppercase">
							<tr>
								<th className="px-4 py-2 font-medium">
									{t("docs.sdks.platform")}
								</th>
								<th className="px-4 py-2 font-medium">
									{t("docs.sdks.package")}
								</th>
								<th className="px-4 py-2 font-medium">
									{t("docs.sdks.requires")}
								</th>
							</tr>
						</thead>
						<tbody>
							{SDKS.map((sdk) => (
								<tr key={sdk.id} className="border-t border-border">
									<td className="px-4 py-2.5 font-medium">{sdk.label}</td>
									<td className="px-4 py-2.5 font-mono text-xs">
										{PACKAGES.find((p) => p.id === sdk.id)?.name}
									</td>
									<td className="px-4 py-2.5 text-muted">{sdk.language}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
				<div className="grid gap-4 md:grid-cols-2">
					{SDKS.map((sdk) => (
						<article
							key={sdk.id}
							className="rounded-xl border border-border bg-surface p-5"
							data-testid="docs-sdk"
						>
							<h3 className="text-base font-semibold">{sdk.label}</h3>
							<p className="mt-1 text-sm text-muted">
								{t(`landing.sdks.${sdk.id}.summary`)}
							</p>
							<ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
								{POINTS.map((point) => (
									<li key={point}>
										{t(`landing.sdks.${sdk.id}.points.${point}`)}
									</li>
								))}
							</ul>
							<CodeBlock
								className="mt-4"
								title={t("settings.install.configure")}
								code={`${sdk.snippet.install}\n\n${sdk.snippet.code}`}
							/>
						</article>
					))}
				</div>
			</DocSection>

			<DocSection
				id="sourcemaps"
				title={t("docs.sections.sourcemaps")}
				intro={t("docs.sourcemaps.intro")}
			>
				<CodeBlock title="bash" code={SOURCEMAPS_COMMAND} />
				<ul className="list-disc space-y-1 pl-5 text-sm text-muted">
					{(["release", "before", "private", "mobile"] as const).map((item) => (
						<li key={item}>{t(`docs.sourcemaps.points.${item}`)}</li>
					))}
				</ul>
			</DocSection>

			<DocSection
				id="tracing"
				title={t("docs.sections.tracing")}
				intro={t("docs.tracing.intro")}
			>
				<CodeBlock title={t("docs.tracing.browser")} code={TRACING_BROWSER} />
				<CodeBlock title={t("docs.tracing.server")} code={TRACING_SERVER} />
				<p className="text-sm text-muted">{t("docs.tracing.outro")}</p>
			</DocSection>

			<DocSection
				id="alerts"
				title={t("docs.sections.alerts")}
				intro={t("docs.alerts.intro")}
			>
				<div className="grid gap-4 md:grid-cols-2">
					<div>
						<h3 className="text-sm font-semibold">{t("docs.alerts.rules")}</h3>
						<ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
							{ALERT_RULES.map((rule) => (
								<li key={rule}>{t(`docs.alerts.ruleItems.${rule}`)}</li>
							))}
						</ul>
					</div>
					<div>
						<h3 className="text-sm font-semibold">
							{t("docs.alerts.channels")}
						</h3>
						<ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
							{ALERT_CHANNELS.map((channel) => (
								<li key={channel}>
									{t(`docs.alerts.channelItems.${channel}`)}
								</li>
							))}
						</ul>
					</div>
				</div>
			</DocSection>

			<DocSection
				id="api"
				title={t("docs.sections.api")}
				intro={t("docs.api.intro")}
			>
				<ul className="space-y-2">
					{ENDPOINTS.map((endpoint) => (
						<li
							key={endpoint.path}
							className="flex flex-wrap items-center gap-2 text-sm"
						>
							<span className="rounded bg-primary-soft px-2 py-0.5 font-mono text-xs font-semibold text-primary">
								{endpoint.method}
							</span>
							<code className="font-mono text-xs">{endpoint.path}</code>
							<span className="text-muted">
								{t(
									`docs.api.endpoints.${endpoint.path.endsWith("events") ? "events" : "transactions"}`,
								)}
							</span>
						</li>
					))}
				</ul>
				<CodeBlock title="cURL" code={httpSnippet({ dsn: SAMPLE_DSN })} />
				<p className="text-sm text-muted">
					{t("docs.api.outro")}{" "}
					<a
						href={API_DOCS_URL}
						className="font-medium text-primary hover:underline"
					>
						{t("public.footer.api")}
					</a>
				</p>
			</DocSection>
		</div>
	);
}
