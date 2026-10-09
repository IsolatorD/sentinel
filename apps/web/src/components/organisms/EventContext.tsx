import { useTranslation } from "react-i18next";
import { CodeBlock } from "@/components/molecules/CodeBlock";
import { KeyValueList } from "@/components/molecules/KeyValueList";
import { Section } from "@/components/molecules/Section";
import { TagPill } from "@/components/molecules/TagPill";
import { contextEntries, type EventView } from "@/lib/event-view";

const browserText = (view: EventView) => {
	const b = contextEntries(view.contexts, "browser");
	const name = b.find(([k]) => k === "name")?.[1];
	const version = b.find(([k]) => k === "version")?.[1];
	return name ? `${name}${version ? ` ${version}` : ""}` : undefined;
};
const osText = (view: EventView) =>
	contextEntries(view.contexts, "os").find(([k]) => k === "name")?.[1];

/** Tags y contexto de un evento: usuario, navegador, release, entorno, URL... */
export function EventContext({ view }: { view: EventView }) {
	const { t } = useTranslation();
	const tags = Object.entries(view.tags ?? {});
	const user = view.user;
	const extra =
		view.extra && Object.keys(view.extra).length > 0
			? JSON.stringify(view.extra, null, 2)
			: undefined;

	return (
		<div className="space-y-4">
			<Section title={t("issue.context.title")}>
				<KeyValueList
					items={[
						{ label: t("issue.context.release"), value: view.release },
						{ label: t("issue.context.environment"), value: view.environment },
						{
							label: t("issue.context.user"),
							value: user?.id ?? user?.username,
						},
						{ label: t("issue.context.email"), value: user?.email },
						{ label: t("issue.context.browser"), value: browserText(view) },
						{ label: t("issue.context.os"), value: osText(view) },
						{ label: t("issue.context.url"), value: view.request?.url },
						{ label: t("issue.context.platform"), value: view.platform },
						{ label: t("issue.context.ip"), value: view._client?.ip },
					]}
				/>
			</Section>
			<Section title={t("issue.tags.title")}>
				{tags.length === 0 ? (
					<p className="text-sm text-muted">{t("issue.tags.empty")}</p>
				) : (
					<div className="flex flex-wrap gap-1.5">
						{tags.map(([name, value]) => (
							<TagPill key={name} name={name} value={value} />
						))}
					</div>
				)}
			</Section>
			{extra && <CodeBlock title="extra" code={extra} />}
		</div>
	);
}
