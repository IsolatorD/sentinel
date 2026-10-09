import type { EventDetailDto, EventSummaryDto } from "@sentinel/shared";
import { ChevronLeft, ChevronRight, ChevronsRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/atoms/Button";
import { RelativeTime } from "@/components/molecules/RelativeTime";

export interface EventNavigatorProps {
	event: EventDetailDto;
	/** Eventos del issue, del más reciente al más antiguo. */
	events: EventSummaryDto[];
	onSelect: (eventId: string | undefined) => void;
}

export function EventNavigator({
	event,
	events,
	onSelect,
}: EventNavigatorProps) {
	const { t } = useTranslation();
	const index = events.findIndex((e) => e.id === event.id);
	const known = index !== -1;
	const newer = known && index > 0 ? events[index - 1] : undefined;
	const older = known ? events[index + 1] : undefined;
	const isLatest = known && index === 0;

	return (
		<div
			className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-2.5 shadow-sm"
			data-testid="event-navigator"
		>
			<div className="min-w-0 text-sm">
				<span className="font-medium text-foreground">
					{t("issue.eventNav.title", { id: event.id.slice(0, 8) })}
				</span>
				<span className="ml-2 text-muted">
					{t("issue.eventNav.recorded", { when: "" }).trim()}{" "}
					<RelativeTime date={event.timestamp} />
				</span>
			</div>
			<div className="flex gap-1.5">
				<Button
					size="sm"
					disabled={!older}
					onClick={() => older && onSelect(older.id)}
				>
					<ChevronLeft className="size-3.5" />
					{t("issue.eventNav.older")}
				</Button>
				<Button
					size="sm"
					disabled={!newer}
					onClick={() => newer && onSelect(newer.id)}
				>
					{t("issue.eventNav.newer")}
					<ChevronRight className="size-3.5" />
				</Button>
				<Button
					size="sm"
					variant="secondary"
					disabled={isLatest}
					onClick={() => onSelect(undefined)}
				>
					{t("issue.eventNav.latest")}
					<ChevronsRight className="size-3.5" />
				</Button>
			</div>
		</div>
	);
}
