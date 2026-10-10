import type { TourId } from "@/hooks/useTour/useTourInterface";

/** Cuánto esperar antes de lanzar un recorrido, para que la pantalla termine de animarse. */
export const TOUR_DELAY_MS = 700;

/** Un recorrido por pantalla; cada paso apunta a un elemento marcado con `data-tour`. */
export const TOURS = {
	welcome: [
		{
			target: "org-switcher",
			title: "tour.welcome.org.title",
			body: "tour.welcome.org.body",
			side: "right",
		},
		{
			target: "project-switcher",
			title: "tour.welcome.project.title",
			body: "tour.welcome.project.body",
			side: "right",
		},
		{
			target: "main-nav",
			title: "tour.welcome.nav.title",
			body: "tour.welcome.nav.body",
			side: "right",
		},
		{
			target: "user-menu",
			title: "tour.welcome.user.title",
			body: "tour.welcome.user.body",
			side: "top",
		},
	],
	issues: [
		{
			target: "issue-filters",
			title: "tour.issues.filters.title",
			body: "tour.issues.filters.body",
			side: "bottom",
		},
		{
			target: "issue-list",
			title: "tour.issues.list.title",
			body: "tour.issues.list.body",
			side: "top",
		},
	],
	performance: [
		{
			target: "performance-overview",
			title: "tour.performance.overview.title",
			body: "tour.performance.overview.body",
			side: "bottom",
		},
		{
			target: "web-vitals",
			title: "tour.performance.vitals.title",
			body: "tour.performance.vitals.body",
			side: "top",
		},
		{
			target: "transactions-table",
			title: "tour.performance.table.title",
			body: "tour.performance.table.body",
			side: "top",
		},
	],
	issueDetail: [
		{
			target: "issue-header",
			title: "tour.issueDetail.header.title",
			body: "tour.issueDetail.header.body",
			side: "bottom",
		},
		{
			target: "issue-assignee",
			title: "tour.issueDetail.assignee.title",
			body: "tour.issueDetail.assignee.body",
			side: "bottom",
		},
		{
			target: "issue-tabs",
			title: "tour.issueDetail.tabs.title",
			body: "tour.issueDetail.tabs.body",
			side: "bottom",
		},
		{
			target: "issue-stack",
			title: "tour.issueDetail.stack.title",
			body: "tour.issueDetail.stack.body",
			side: "top",
		},
	],
} as const satisfies Record<TourId, ReadonlyArray<unknown>>;
