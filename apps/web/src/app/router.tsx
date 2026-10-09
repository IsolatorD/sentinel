import type { QueryClient } from "@tanstack/react-query";
import type { RouterHistory } from "@tanstack/react-router";
import {
	createRootRouteWithContext,
	createRoute,
	createRouter,
	Outlet,
	redirect,
} from "@tanstack/react-router";
import { sessionQueryOptions } from "@/hooks/use-session";
import { HomePage } from "@/pages/HomePage";
import { IssueDetailPage } from "@/pages/IssueDetailPage";
import { IssuesPage } from "@/pages/IssuesPage";
import { LoginPage } from "@/pages/LoginPage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { OnboardingPage } from "@/pages/OnboardingPage";
import { OrgHomePage } from "@/pages/OrgHomePage";
import { OrgLayoutPage } from "@/pages/OrgLayoutPage";
import { ProjectSettingsPage } from "@/pages/ProjectSettingsPage";
import { ProjectsPage } from "@/pages/ProjectsPage";
import { RegisterPage } from "@/pages/RegisterPage";
import { ReleasesPage } from "@/pages/ReleasesPage";
import { TokensPage } from "@/pages/TokensPage";
import {
	issueSearchInputSchema,
	issuesSearchInputSchema,
} from "@/utils/searchParams/searchParams.constants";

export interface RouterContext {
	queryClient: QueryClient;
}

const rootRoute = createRootRouteWithContext<RouterContext>()({
	component: Outlet,
	notFoundComponent: NotFoundPage,
});

// ---------- Público: solo para quien NO tiene sesión ----------
const guestRoute = createRoute({
	getParentRoute: () => rootRoute,
	id: "guest",
	beforeLoad: async ({ context }) => {
		if (await context.queryClient.ensureQueryData(sessionQueryOptions))
			throw redirect({ to: "/" });
	},
	component: Outlet,
});
const loginRoute = createRoute({
	getParentRoute: () => guestRoute,
	path: "/login",
	component: LoginPage,
});
const registerRoute = createRoute({
	getParentRoute: () => guestRoute,
	path: "/register",
	component: RegisterPage,
});

// ---------- Privado: requiere sesión ----------
const authedRoute = createRoute({
	getParentRoute: () => rootRoute,
	id: "authed",
	beforeLoad: async ({ context }) => {
		if (!(await context.queryClient.ensureQueryData(sessionQueryOptions)))
			throw redirect({ to: "/login" });
	},
	component: Outlet,
});
const homeRoute = createRoute({
	getParentRoute: () => authedRoute,
	path: "/",
	component: HomePage,
});
const onboardingRoute = createRoute({
	getParentRoute: () => authedRoute,
	path: "/onboarding",
	component: OnboardingPage,
});

// /$orgSlug/...
const orgRoute = createRoute({
	getParentRoute: () => authedRoute,
	path: "/$orgSlug",
	component: OrgLayoutPage,
});
const orgIndexRoute = createRoute({
	getParentRoute: () => orgRoute,
	path: "/",
	component: OrgHomePage,
});
const tokensRoute = createRoute({
	getParentRoute: () => orgRoute,
	path: "tokens",
	component: TokensPage,
});
const projectsRoute = createRoute({
	getParentRoute: () => orgRoute,
	path: "projects",
	component: Outlet,
});
const projectsIndexRoute = createRoute({
	getParentRoute: () => projectsRoute,
	path: "/",
	component: ProjectsPage,
});
const projectRoute = createRoute({
	getParentRoute: () => projectsRoute,
	path: "$projectSlug",
	component: Outlet,
});
const issuesRoute = createRoute({
	getParentRoute: () => projectRoute,
	path: "issues",
	validateSearch: (search: Record<string, unknown>) =>
		issuesSearchInputSchema.parse(search),
	component: IssuesPage,
});
const issueRoute = createRoute({
	getParentRoute: () => projectRoute,
	path: "issues/$issueId",
	validateSearch: (search: Record<string, unknown>) =>
		issueSearchInputSchema.parse(search),
	component: IssueDetailPage,
});
const releasesRoute = createRoute({
	getParentRoute: () => projectRoute,
	path: "releases",
	component: ReleasesPage,
});
const settingsRoute = createRoute({
	getParentRoute: () => projectRoute,
	path: "settings",
	component: ProjectSettingsPage,
});

const routeTree = rootRoute.addChildren([
	guestRoute.addChildren([loginRoute, registerRoute]),
	authedRoute.addChildren([
		homeRoute,
		onboardingRoute,
		orgRoute.addChildren([
			orgIndexRoute,
			tokensRoute,
			projectsRoute.addChildren([
				projectsIndexRoute,
				projectRoute.addChildren([
					issuesRoute,
					issueRoute,
					releasesRoute,
					settingsRoute,
				]),
			]),
		]),
	]),
]);

export function createAppRouter(
	queryClient: QueryClient,
	history?: RouterHistory,
) {
	return createRouter({
		routeTree,
		history,
		context: { queryClient },
		defaultPreload: "intent",
		scrollRestoration: true,
	});
}

declare module "@tanstack/react-router" {
	interface Register {
		router: ReturnType<typeof createAppRouter>;
	}
}
