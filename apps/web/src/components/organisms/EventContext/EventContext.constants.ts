import { contextEntries } from "@/utils/eventView/eventView";
import type { EventView } from "@/utils/eventView/eventViewInterface";

export const browserText = (view: EventView) => {
	const b = contextEntries(view.contexts, "browser");
	const name = b.find(([k]) => k === "name")?.[1];
	const version = b.find(([k]) => k === "version")?.[1];
	return name ? `${name}${version ? ` ${version}` : ""}` : undefined;
};

export const osText = (view: EventView) =>
	contextEntries(view.contexts, "os").find(([k]) => k === "name")?.[1];
