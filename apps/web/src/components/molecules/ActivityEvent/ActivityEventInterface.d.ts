export type ActivityEventKey =
	| "activity.events.resolved"
	| "activity.events.resolvedInRelease"
	| "activity.events.resolvedNextRelease"
	| "activity.events.reopened"
	| "activity.events.ignored"
	| "activity.events.assigned"
	| "activity.events.assignedSelf"
	| "activity.events.unassigned"
	| "activity.events.reassigned"
	| "activity.events.generic";

export interface Person {
	id?: string;
	name?: string;
}
