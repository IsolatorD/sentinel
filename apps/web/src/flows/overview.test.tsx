import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { dashboardService } from "@/services/dashboardService/dashboardService";
import * as fx from "@/test/fixtures";
import { mockHappyPath, renderApp } from "@/test/render-app";
import { ApiError } from "@/utils/apiError/apiError";

vi.mock("@/services/authService/authService");
vi.mock("@/services/configService/configService");
vi.mock("@/services/organizationsService/organizationsService");
vi.mock("@/services/projectsService/projectsService");
vi.mock("@/services/issuesService/issuesService");

const OVERVIEW_PATH = "/acme/projects/storefront/overview";
const lastQuery = () => vi.mocked(dashboardService.get).mock.calls.at(-1)?.[2];

beforeEach(() => {
	vi.resetAllMocks();
	mockHappyPath();
});

describe("resumen del proyecto", () => {
	it("el menú lleva a la pantalla, que muestra los números del periodo con su variación", async () => {
		const { user } = renderApp("/acme/projects/storefront/issues");
		await user.click(await screen.findByRole("link", { name: "Overview" }));

		const tiles = await screen.findAllByTestId("stat-tile");
		expect(tiles).toHaveLength(7);
		const byLabel = (label: string) =>
			tiles.find((t) => t.textContent?.startsWith(label)) as HTMLElement;
		expect(byLabel("Events")).toHaveTextContent("1.3K");
		expect(byLabel("Users affected")).toHaveTextContent("312");
		expect(byLabel("Resolved")).toHaveTextContent("4");
		expect(byLabel("p95")).toHaveTextContent("2.4 s");
		expect(byLabel("Error rate")).toHaveTextContent("3.8%");

		// 1284 vs 1000 = +28.4 %: más errores es malo (rojo). 9 vs 12 issues nuevos = −25 %: bueno (verde).
		const events = within(byLabel("Events")).getByTestId("stat-change");
		expect(events).toHaveTextContent("+28.4% vs previous period");
		expect(events).toHaveAttribute("data-direction", "up");
		expect(events.className).toContain("text-danger");
		const issues = within(byLabel("New issues")).getByTestId("stat-change");
		expect(issues).toHaveTextContent("-25% vs previous period");
		expect(issues.className).toContain("text-success");
		// Sin transacciones en el periodo anterior no hay base para comparar.
		expect(
			within(byLabel("Transactions")).getByTestId("stat-change"),
		).toHaveTextContent("no earlier data");
	});

	it("reparte por nivel, entorno y release, con 'sin dato' y 'otros'", async () => {
		renderApp(OVERVIEW_PATH);
		const level = await screen.findByTestId("by-level");
		expect(
			within(level)
				.getAllByTestId("breakdown-item")
				.map((i) => i.textContent),
		).toEqual(["Error900", "Warning300", "Fatal84"]);
		const env = screen.getByTestId("by-environment");
		expect(within(env).getByText("production")).toBeInTheDocument();
		expect(within(env).getByText("Unknown")).toBeInTheDocument();
		expect(
			within(screen.getByTestId("by-release")).getByText("Other"),
		).toBeInTheDocument();
	});

	it("los rankings enlazan al issue y a la transacción", async () => {
		const { user, router } = renderApp(OVERVIEW_PATH);
		const issues = await screen.findAllByTestId("top-issue");
		expect(issues).toHaveLength(2);
		expect(within(issues[0]).getByRole("link")).toHaveAttribute(
			"href",
			expect.stringContaining(`/issues/${fx.ISSUE_ID}`),
		);

		const slow = screen.getAllByTestId("slow-item");
		await user.click(within(slow[0]).getByRole("link", { name: "/checkout" }));
		await waitFor(() =>
			expect(router.state.location.pathname).toContain(
				"/performance/transaction",
			),
		);
		expect(router.state.location.search).toMatchObject({ name: "/checkout" });
	});

	it("dibuja los dos gráficos y cambiar de periodo vuelve a consultar con él", async () => {
		const { user } = renderApp(OVERVIEW_PATH);
		const charts = await screen.findByTestId("overview-charts");
		expect(within(charts).getAllByTestId("bar-chart")).toHaveLength(2);
		expect(lastQuery()).toMatchObject({ period: "7d" });

		await user.click(screen.getByRole("button", { name: "30 days" }));
		await waitFor(() => expect(lastQuery()).toMatchObject({ period: "30d" }));
	});

	it("sin datos lo dice en cada tarjeta en lugar de dibujar gráficos vacíos", async () => {
		vi.mocked(dashboardService.get).mockResolvedValue(
			fx.dashboard({
				totals: {
					events: 0,
					users: 0,
					newIssues: 0,
					resolvedIssues: 0,
					transactions: 0,
					p95: null,
					errorRate: 0,
				},
				previous: { events: 0, newIssues: 0, transactions: 0 },
				byLevel: [],
				byEnvironment: [],
				byRelease: [],
				topIssues: [],
				slowest: [],
			}),
		);
		renderApp(OVERVIEW_PATH);
		await screen.findByTestId("overview-tiles");
		expect(screen.queryByTestId("bar-chart")).not.toBeInTheDocument();
		expect(
			screen.getAllByText("No data in this period.").length,
		).toBeGreaterThanOrEqual(5);
	});

	it("si falla la carga ofrece reintentar", async () => {
		vi.mocked(dashboardService.get)
			.mockRejectedValueOnce(new ApiError(500, "boom"))
			.mockResolvedValue(fx.dashboard());
		const { user } = renderApp(OVERVIEW_PATH);
		expect(
			await screen.findByText("Couldn't load the overview."),
		).toBeInTheDocument();
		await user.click(screen.getByRole("button", { name: "Try again" }));
		expect(await screen.findByTestId("overview-tiles")).toBeInTheDocument();
	});
});
