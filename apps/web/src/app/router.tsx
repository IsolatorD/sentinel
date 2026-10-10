import type { QueryClient } from "@tanstack/react-query";
import type { RouterHistory } from "@tanstack/react-router";
import {
	createRootRouteWithContext,
	createRoute,
	createRouter,
	Outlet,
	redirect,
} from "@tanstack/react-router";
import { sessionQueryOptions } from "@/hooks/useSession/useSession.constants";
import { AcceptInvitationPage } from "@/pages/AcceptInvitationPage/AcceptInvitationPage";
import { AlertsPage } from "@/pages/AlertsPage/AlertsPage";
import { AuthedLayoutPage } from "@/pages/AuthedLayoutPage/AuthedLayoutPage";
import { DocsPage } from "@/pages/DocsPage/DocsPage";
import { EmailVerifiedPage } from "@/pages/EmailVerifiedPage/EmailVerifiedPage";
import { IndexPage } from "@/pages/IndexPage/IndexPage";
import { IssueDetailPage } from "@/pages/IssueDetailPage/IssueDetailPage";
import { IssuesPage } from "@/pages/IssuesPage/IssuesPage";
import { LoginPage } from "@/pages/LoginPage/LoginPage";
import { MembersPage } from "@/pages/MembersPage/MembersPage";
import { NotFoundPage } from "@/pages/NotFoundPage/NotFoundPage";
import { OnboardingPage } from "@/pages/OnboardingPage/OnboardingPage";
import { OrgHomePage } from "@/pages/OrgHomePage/OrgHomePage";
import { OrgLayoutPage } from "@/pages/OrgLayoutPage/OrgLayoutPage";
import { OverviewPage } from "@/pages/OverviewPage/OverviewPage";
import { PerformancePage } from "@/pages/PerformancePage/PerformancePage";
import { ProjectSettingsPage } from "@/pages/ProjectSettingsPage/ProjectSettingsPage";
import { ProjectsPage } from "@/pages/ProjectsPage/ProjectsPage";
import { RegisterPage } from "@/pages/RegisterPage/RegisterPage";
import { ReleasesPage } from "@/pages/ReleasesPage/ReleasesPage";
import { RouteErrorPage } from "@/pages/RouteErrorPage/RouteErrorPage";
import { SamplePage } from "@/pages/SamplePage/SamplePage";
import { TokensPage } from "@/pages/TokensPage/TokensPage";
import { TracePage } from "@/pages/TracePage/TracePage";
import { TransactionPage } from "@/pages/TransactionPage/TransactionPage";
import { VerifyEmailPage } from "@/pages/VerifyEmailPage/VerifyEmailPage";
import { safeRedirect } from "@/utils/redirect/redirect";
import {
	alertsSearchInputSchema,
	issueSearchInputSchema,
	issuesSearchInputSchema,
	overviewSearchInputSchema,
	performanceSearchInputSchema,
	transactionSearchInputSchema,
} from "@/utils/searchParams/searchParams.constants";
import {
	parseVerifiedSearch,
	parseVerifySearch,
} from "@/utils/verification/verification";

export interface RouterContext {
	queryClient: QueryClient;
}

const rootRoute = createRootRouteWithContext<RouterContext>()({
	component: Outlet,
	notFoundComponent: NotFoundPage,
});

// ---------- Público: con o sin sesión ----------
// `/` es la landing para quien no tiene sesión; con sesión lleva a su organización.
const indexRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/",
	component: IndexPage,
});
const docsRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/docs",
	component: DocsPage,
});
// (verificación de correo)
const verifyEmailRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/verify-email",
	validateSearch: parseVerifySearch,
	component: VerifyEmailPage,
});
const emailVerifiedRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/email-verified",
	validateSearch: parseVerifiedSearch,
	component: EmailVerifiedPage,
});

// ---------- Público: solo para quien NO tiene sesión ----------
const guestRoute = createRoute({
	getParentRoute: () => rootRoute,
	id: "guest",
	beforeLoad: async ({ context, location }) => {
		if (await context.queryClient.ensureQueryData(sessionQueryOptions)) {
			const target = safeRedirect(
				(location.search as { redirect?: unknown }).redirect,
			);
			if (target) throw redirect({ href: target });
			throw redirect({ to: "/" });
		}
	},
	component: Outlet,
});
const loginRoute = createRoute({
	getParentRoute: () => guestRoute,
	path: "/login",
	validateSearch: (search: Record<string, unknown>): { redirect?: string } => {
		const redirect = safeRedirect(search.redirect);
		return redirect ? { redirect } : {};
	},
	component: LoginPage,
});
const registerRoute = createRoute({
	getParentRoute: () => guestRoute,
	path: "/register",
	validateSearch: (search: Record<string, unknown>): { redirect?: string } => {
		const redirect = safeRedirect(search.redirect);
		return redirect ? { redirect } : {};
	},
	component: RegisterPage,
});

// ---------- Privado: requiere sesión ----------
const authedRoute = createRoute({
	getParentRoute: () => rootRoute,
	id: "authed",
	beforeLoad: async ({ context, location }) => {
		if (!(await context.queryClient.ensureQueryData(sessionQueryOptions))) {
			// Se recuerda a dónde iba (p. ej. el enlace de una invitación) para volver tras el login.
			const back =
				location.href === "/" ? undefined : safeRedirect(location.href);
			throw redirect({ to: "/login", search: back ? { redirect: back } : {} });
		}
	},
	component: AuthedLayoutPage,
});
const onboardingRoute = createRoute({
	getParentRoute: () => authedRoute,
	path: "/onboarding",
	component: OnboardingPage,
});

// /$orgSlug/...
const acceptInvitationRoute = createRoute({
	getParentRoute: () => authedRoute,
	path: "/accept-invitation/$invitationId",
	component: AcceptInvitationPage,
});
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
const membersRoute = createRoute({
	getParentRoute: () => orgRoute,
	path: "members",
	component: MembersPage,
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
const overviewRoute = createRoute({
	getParentRoute: () => projectRoute,
	path: "overview",
	validateSearch: (search: Record<string, unknown>) =>
		overviewSearchInputSchema.parse(search),
	component: OverviewPage,
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
const performanceRoute = createRoute({
	getParentRoute: () => projectRoute,
	path: "performance",
	validateSearch: (search: Record<string, unknown>) =>
		performanceSearchInputSchema.parse(search),
	component: PerformancePage,
});
const transactionRoute = createRoute({
	getParentRoute: () => projectRoute,
	path: "performance/transaction",
	validateSearch: (search: Record<string, unknown>) =>
		transactionSearchInputSchema.parse(search),
	component: TransactionPage,
});
const sampleRoute = createRoute({
	getParentRoute: () => projectRoute,
	path: "performance/samples/$sampleId",
	component: SamplePage,
});
const traceRoute = createRoute({
	getParentRoute: () => projectRoute,
	path: "performance/traces/$traceId",
	component: TracePage,
});
const alertsRoute = createRoute({
	getParentRoute: () => projectRoute,
	path: "alerts",
	validateSearch: (search: Record<string, unknown>) =>
		alertsSearchInputSchema.parse(search),
	component: AlertsPage,
});
const settingsRoute = createRoute({
	getParentRoute: () => projectRoute,
	path: "settings",
	component: ProjectSettingsPage,
});

const routeTree = rootRoute.addChildren([
	indexRoute,
	docsRoute,
	verifyEmailRoute,
	emailVerifiedRoute,
	guestRoute.addChildren([loginRoute, registerRoute]),
	authedRoute.addChildren([
		onboardingRoute,
		acceptInvitationRoute,
		orgRoute.addChildren([
			orgIndexRoute,
			membersRoute,
			tokensRoute,
			projectsRoute.addChildren([
				projectsIndexRoute,
				projectRoute.addChildren([
					overviewRoute,
					issuesRoute,
					issueRoute,
					performanceRoute,
					transactionRoute,
					sampleRoute,
					traceRoute,
					releasesRoute,
					alertsRoute,
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
		// Un fallo al cargar una ruta (p. ej. la API no contesta) se explica en lugar de mostrar el error técnico.
		defaultErrorComponent: ({ error }) => <RouteErrorPage error={error} />,
		// Fundido entre pantallas, solo cuando cambia la ruta (no al filtrar, ordenar o paginar).
		defaultViewTransition: {
			types: ({ pathChanged }) => (pathChanged ? ["page"] : false),
		},
		scrollRestoration: true,
	});
}

declare module "@tanstack/react-router" {
	interface Register {
		router: ReturnType<typeof createAppRouter>;
	}
}
