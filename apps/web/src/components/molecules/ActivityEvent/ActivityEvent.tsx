import type { ActivityDto } from "@sentinel/shared";
import { useTranslation } from "react-i18next";
import { describeActivity } from "@/components/molecules/ActivityEvent/ActivityEvent.constants";
import { RelativeTime } from "@/components/molecules/RelativeTime/RelativeTime";

/** Una línea del historial: un cambio de estado o de responsable. */
export function ActivityEvent({ entry }: { entry: ActivityDto }) {
	const { t } = useTranslation();
	const { key, values } = describeActivity(entry, t("activity.someone"));
	// La clave se elige en tiempo de ejecución entre las de `activity.events`; los tipos de t() no la ligan a sus valores.
	const sentence = (t as (key: string, values: object) => string)(key, values);
	return (
		<li
			className="flex items-center gap-2 py-1.5 pl-1 text-sm text-muted"
			data-testid="activity-event"
		>
			<span
				aria-hidden
				className="size-2 shrink-0 rounded-full bg-border-strong"
			/>
			<span>{sentence}</span>
			<RelativeTime date={entry.createdAt} className="text-xs text-faint" />
		</li>
	);
}
