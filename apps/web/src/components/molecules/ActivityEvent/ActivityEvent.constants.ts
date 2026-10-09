import type { ActivityDto } from "@sentinel/shared";
import type {
	ActivityEventKey,
	Person,
} from "@/components/molecules/ActivityEvent/ActivityEventInterface";

const asPerson = (value: unknown): Person | null =>
	value && typeof value === "object" ? (value as Person) : null;

/**
 * Qué frase de la traducción describe una entrada del historial y con qué valores. Tolera datos
 * incompletos (el historial es un registro: nunca debe romper la pantalla).
 */
export function describeActivity(
	entry: ActivityDto,
	someone: string,
): { key: ActivityEventKey; values: Record<string, string> } {
	const who = entry.actor?.name ?? someone;
	const data = entry.data ?? {};

	if (entry.type === "status") {
		const to = String(data.to ?? "");
		const release = typeof data.release === "string" ? data.release : undefined;
		if (to === "resolved") {
			if (!release) return { key: "activity.events.resolved", values: { who } };
			return {
				key: data.inclusive
					? "activity.events.resolvedInRelease"
					: "activity.events.resolvedNextRelease",
				values: { who, release },
			};
		}
		if (to === "unresolved")
			return { key: "activity.events.reopened", values: { who } };
		if (to === "ignored")
			return { key: "activity.events.ignored", values: { who } };
	}

	if (entry.type === "assignment") {
		const from = asPerson(data.from);
		const to = asPerson(data.to);
		if (!to)
			return {
				key: "activity.events.unassigned",
				values: { who, from: from?.name ?? "" },
			};
		if (entry.actor && to.id === entry.actor.id)
			return { key: "activity.events.assignedSelf", values: { who } };
		if (from)
			return {
				key: "activity.events.reassigned",
				values: { who, from: from.name ?? "", to: to.name ?? "" },
			};
		return {
			key: "activity.events.assigned",
			values: { who, to: to.name ?? "" },
		};
	}

	return { key: "activity.events.generic", values: { who } };
}
