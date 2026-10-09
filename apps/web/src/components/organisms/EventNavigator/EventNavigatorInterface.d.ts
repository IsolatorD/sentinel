import type { EventDetailDto, EventSummaryDto } from "@sentinel/shared";

export interface EventNavigatorProps {
	event: EventDetailDto;
	/** Eventos del issue, del más reciente al más antiguo. */
	events: EventSummaryDto[];
	onSelect: (eventId: string | undefined) => void;
}
