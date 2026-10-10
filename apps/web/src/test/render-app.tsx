import { QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Toaster } from "sonner";
import { vi } from "vitest";
import { createQueryClient } from "@/app/query-client";
import { createAppRouter } from "@/app/router";
import { authService } from "@/services/authService/authService";
import { configService } from "@/services/configService/configService";
import { issuesService } from "@/services/issuesService/issuesService";
import { organizationsService } from "@/services/organizationsService/organizationsService";
import { performanceService } from "@/services/performanceService/performanceService";
import { preferencesService } from "@/services/preferencesService/preferencesService";
import { projectsService } from "@/services/projectsService/projectsService";
import { statsService } from "@/services/statsService/statsService";
import * as fx from "./fixtures";

/** Monta la aplicación real (router, caché, páginas) en una ruta; los servicios se simulan en cada test. */
export function renderApp(path: string) {
	const queryClient = createQueryClient({ retry: false });
	const history = createMemoryHistory({ initialEntries: [path] });
	const router = createAppRouter(queryClient, history);
	const utils = render(
		<QueryClientProvider client={queryClient}>
			<RouterProvider router={router} />
			<Toaster />
		</QueryClientProvider>,
	);
	return { ...utils, router, queryClient, user: userEvent.setup() };
}

/**
 * Servicios simulados con un caso feliz: sesión iniciada, una organización con un proyecto
 * y un issue. Cada test sobreescribe lo que necesite. Requiere `vi.mock` de los servicios.
 */
export function mockHappyPath() {
	vi.mocked(authService.getSession).mockResolvedValue({ user: fx.user });
	vi.mocked(configService.getPublicConfig).mockResolvedValue({
		authProviders: { google: false },
		emailEnabled: true,
		emailVerification: false,
	});
	vi.mocked(organizationsService.list).mockResolvedValue([fx.org]);
	// Sin preferencias guardadas que cambien el idioma, el tema o los recorridos de la prueba.
	vi.mocked(preferencesService.get).mockResolvedValue({
		locale: "en",
		theme: "system",
		toursSeen: [],
	});
	vi.mocked(preferencesService.update).mockImplementation(async (input) => ({
		locale: "en",
		theme: "system",
		toursSeen: [],
		...input,
	}));
	vi.mocked(projectsService.list).mockResolvedValue([fx.project]);
	vi.mocked(projectsService.get).mockResolvedValue(fx.project);
	vi.mocked(projectsService.usage).mockResolvedValue(fx.usage());
	vi.mocked(performanceService.transactions).mockResolvedValue(
		fx.transactionList(),
	);
	vi.mocked(performanceService.overview).mockResolvedValue(fx.overview());
	vi.mocked(performanceService.samples).mockResolvedValue(fx.sampleList());
	vi.mocked(performanceService.sample).mockResolvedValue(fx.sampleDetail());
	vi.mocked(performanceService.trace).mockResolvedValue(fx.trace());
	vi.mocked(statsService.project).mockResolvedValue(fx.stats());
	vi.mocked(statsService.issue).mockResolvedValue(fx.stats());
	vi.mocked(issuesService.list).mockResolvedValue(fx.issueList());
	vi.mocked(issuesService.get).mockResolvedValue(fx.issueDetail());
	vi.mocked(issuesService.listEvents).mockResolvedValue(fx.eventList());
	vi.mocked(issuesService.getEvent).mockResolvedValue(fx.event());
	vi.mocked(issuesService.updateStatus).mockImplementation(
		async (_o, _p, _i, input) => fx.issue({ status: input.status }),
	);
}

export const ISSUES_PATH = "/acme/projects/storefront/issues";
export const ISSUE_PATH = `${ISSUES_PATH}/${fx.ISSUE_ID}`;
export const SETTINGS_PATH = "/acme/projects/storefront/settings";
