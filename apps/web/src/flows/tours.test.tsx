import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as fx from "@/test/fixtures";
import {
	ISSUE_PATH,
	ISSUES_PATH,
	mockHappyPath,
	renderApp,
} from "@/test/render-app";
import { tourSeenKey } from "@/utils/storage/storage.constants";
import { startTour } from "@/utils/tour/tour";

vi.mock("@/services/authService/authService");
vi.mock("@/services/configService/configService");
vi.mock("@/services/organizationsService/organizationsService");
vi.mock("@/services/projectsService/projectsService");
vi.mock("@/services/issuesService/issuesService");
// El dibujo del recorrido es de driver.js; aquí se comprueba cuándo se lanza y con qué.
vi.mock("@/utils/tour/tour", () => ({
	isTourEnabled: () => true,
	isTourActive: () => false,
	startTour: vi.fn(() => true),
}));

const seen = (tour: string) =>
	window.localStorage.getItem(tourSeenKey(fx.user.id, tour));
const markSeen = (...tours: string[]) => {
	for (const tour of tours)
		window.localStorage.setItem(tourSeenKey(fx.user.id, tour), "1");
};
const calls = () => vi.mocked(startTour).mock.calls.map(([options]) => options);
const started = (target: string) =>
	calls().some((o) => o.steps.some((s) => s.target === target));

beforeEach(() => {
	vi.resetAllMocks();
	vi.mocked(startTour).mockReturnValue(true);
	mockHappyPath();
});

describe("recorridos guiados", () => {
	it("la primera vez, la bienvenida se lanza sola con sus pasos traducidos", async () => {
		renderApp(ISSUES_PATH);
		await waitFor(() => expect(startTour).toHaveBeenCalled(), {
			timeout: 3000,
		});
		const welcome = calls()[0];
		expect(welcome.steps.map((s) => s.target)).toEqual([
			"org-switcher",
			"project-switcher",
			"main-nav",
			"user-menu",
		]);
		expect(welcome.steps[0].title).toBe("Your organization");
		expect(welcome.labels).toMatchObject({
			next: "Next",
			back: "Back",
			done: "Done",
		});
	});

	it("al cerrarla se recuerda por usuario y no vuelve a lanzarse", async () => {
		const first = renderApp(ISSUES_PATH);
		await waitFor(() => expect(startTour).toHaveBeenCalled(), {
			timeout: 3000,
		});
		expect(seen("welcome")).toBeNull();
		calls()[0].onClose();
		expect(seen("welcome")).toBe("1");
		first.unmount();

		vi.mocked(startTour).mockClear();
		renderApp(ISSUES_PATH);
		await screen.findByTestId("issue-list");
		await new Promise((r) => setTimeout(r, 1200));
		expect(started("org-switcher")).toBe(false);
	});

	it("las pantallas esperan a que se haya visto la bienvenida", async () => {
		renderApp(ISSUES_PATH);
		await screen.findByTestId("issue-list");
		await waitFor(() => expect(startTour).toHaveBeenCalled(), {
			timeout: 3000,
		});
		await new Promise((r) => setTimeout(r, 1000));
		// Solo la bienvenida: el de issues no se monta encima.
		expect(started("issue-list")).toBe(false);
	});

	it("con la bienvenida vista, el listado de issues explica sus filtros y su lista", async () => {
		markSeen("welcome");
		renderApp(ISSUES_PATH);
		await waitFor(() => expect(started("issue-filters")).toBe(true), {
			timeout: 3000,
		});
		expect(
			calls()
				.find((o) => o.steps[0].target === "issue-filters")
				?.steps.map((s) => s.target),
		).toEqual(["issue-filters", "issue-list"]);
		expect(started("org-switcher")).toBe(false);
	});

	it("el detalle de un issue explica cabecera, responsable, pestañas y stack trace", async () => {
		markSeen("welcome", "issues");
		renderApp(ISSUE_PATH);
		await waitFor(() => expect(started("issue-header")).toBe(true), {
			timeout: 3000,
		});
		expect(
			calls()
				.at(-1)
				?.steps.map((s) => s.target),
		).toEqual(["issue-header", "issue-assignee", "issue-tabs", "issue-stack"]);
	});

	it("un recorrido ya visto no se repite aunque se vuelva a la pantalla", async () => {
		markSeen("welcome", "issues");
		renderApp(ISSUES_PATH);
		await screen.findByTestId("issue-list");
		await new Promise((r) => setTimeout(r, 1200));
		expect(startTour).not.toHaveBeenCalled();
	});

	it("el menú de la persona permite repetir el recorrido y lo reinicia todo", async () => {
		markSeen("welcome", "issues", "issueDetail");
		const { user } = renderApp(ISSUES_PATH);
		await user.click(await screen.findByRole("button", { name: "Account" }));
		await user.click(
			await screen.findByRole("menuitem", { name: "Show the guided tour" }),
		);
		expect(startTour).toHaveBeenCalledTimes(1);
		expect(calls()[0].steps[0].target).toBe("org-switcher");
		// Se olvidó lo visto: los demás recorridos volverán a lanzarse.
		expect(seen("issues")).toBeNull();
		expect(seen("issueDetail")).toBeNull();
	});
});
