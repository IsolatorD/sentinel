import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as fx from "@/test/fixtures";
import { ISSUES_PATH, mockHappyPath, renderApp } from "@/test/render-app";
import { SIDEBAR_COLLAPSED_KEY } from "@/utils/storage/storage.constants";

vi.mock("@/services/authService/authService");
vi.mock("@/services/configService/configService");
vi.mock("@/services/organizationsService/organizationsService");
vi.mock("@/services/projectsService/projectsService");
vi.mock("@/services/issuesService/issuesService");

beforeEach(() => {
	vi.resetAllMocks();
	mockHappyPath();
});

const inSidebar = () => within(screen.getByTestId("sidebar"));
const shell = () =>
	screen.getByTestId("sidebar").closest("aside") as HTMLElement;

describe("barra lateral en modo mini", () => {
	it("empieza expandida, y el botón la pliega a solo iconos sin perder los enlaces", async () => {
		const { user } = renderApp(ISSUES_PATH);
		await screen.findByTestId("sidebar");
		expect(shell()).toHaveAttribute("data-collapsed", "false");
		expect(await inSidebar().findByText(fx.project.name)).toBeInTheDocument(); // el proyecto, con nombre

		await user.click(screen.getByRole("button", { name: "Collapse menu" }));
		expect(shell()).toHaveAttribute("data-collapsed", "true");

		// El nombre del proyecto y los datos de la cuenta ya no se ven...
		expect(inSidebar().queryByText(fx.project.name)).not.toBeInTheDocument();
		expect(inSidebar().queryByText(fx.user.email)).not.toBeInTheDocument();
		// ...pero cada enlace sigue accesible por su nombre, con el texto como título.
		const nav = screen.getByRole("navigation", { name: "Main navigation" });
		const issues = within(nav).getByRole("link", { name: "Issues" });
		expect(issues).toHaveAttribute("title", "Issues");
		expect(issues).toHaveAttribute("href", expect.stringContaining("/issues"));
		expect(screen.getByRole("button", { name: "Account" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Expand menu" })).toHaveAttribute(
			"aria-pressed",
			"true",
		);
	});

	it("se recuerda: al volver a abrir la app sigue plegada, y se puede expandir de nuevo", async () => {
		window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, "1");
		const { user } = renderApp(ISSUES_PATH);
		await screen.findByTestId("sidebar");
		expect(shell()).toHaveAttribute("data-collapsed", "true");

		await user.click(screen.getByRole("button", { name: "Expand menu" }));
		expect(shell()).toHaveAttribute("data-collapsed", "false");
		expect(window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY)).toBe("0");
		expect(inSidebar().getByText(fx.project.name)).toBeInTheDocument();
	});
});
