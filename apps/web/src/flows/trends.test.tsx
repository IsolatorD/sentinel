import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { issuesService } from "@/services/issuesService/issuesService";
import { statsService } from "@/services/statsService/statsService";
import * as fx from "@/test/fixtures";
import { ISSUES_PATH, mockHappyPath, renderApp } from "@/test/render-app";

vi.mock("@/services/authService/authService");
vi.mock("@/services/configService/configService");
vi.mock("@/services/organizationsService/organizationsService");
vi.mock("@/services/projectsService/projectsService");
vi.mock("@/services/issuesService/issuesService");

beforeEach(() => {
	vi.resetAllMocks();
	mockHappyPath();
});

describe("gráficos de tendencia", () => {
	it("el listado muestra el gráfico del proyecto y cambia de periodo", async () => {
		const { user } = renderApp(ISSUES_PATH);
		const card = await screen.findByTestId("trend-card");
		expect(await within(card).findByTestId("bar-chart")).toBeInTheDocument();
		expect(within(card).getByText("8 events")).toBeInTheDocument();
		expect(statsService.project).toHaveBeenLastCalledWith(
			expect.any(String),
			expect.any(String),
			"24h",
		);

		await user.click(within(card).getByRole("button", { name: "7 days" }));
		await waitFor(() =>
			expect(statsService.project).toHaveBeenLastCalledWith(
				expect.any(String),
				expect.any(String),
				"7d",
			),
		);
		expect(
			within(card).getByRole("button", { name: "7 days" }),
		).toHaveAttribute("aria-pressed", "true");
	});

	it("sin eventos en el periodo se avisa en lugar de dibujar el gráfico", async () => {
		vi.mocked(statsService.project).mockResolvedValue(fx.stats({}, [0, 0, 0]));
		renderApp(ISSUES_PATH);
		expect(
			await screen.findByText("No events in this period"),
		).toBeInTheDocument();
		expect(screen.queryByTestId("bar-chart")).not.toBeInTheDocument();
	});

	it("si falla la carga ofrece reintentar", async () => {
		vi.mocked(statsService.project).mockRejectedValueOnce(new Error("boom"));
		const { user } = renderApp(ISSUES_PATH);
		expect(
			await screen.findByText("Couldn't load the chart."),
		).toBeInTheDocument();
		const card = screen.getByTestId("trend-card");
		await user.click(within(card).getByRole("button", { name: "Try again" }));
		expect(await within(card).findByTestId("bar-chart")).toBeInTheDocument();
	});

	it("cada fila del listado lleva su mini gráfico de las últimas 24 h", async () => {
		const issue = fx.issue();
		vi.mocked(issuesService.list).mockResolvedValue({
			...fx.issueList([issue]),
			trends: { [issue.id]: Array.from({ length: 24 }, (_, i) => i % 5) },
		});
		renderApp(ISSUES_PATH);
		const row = await screen.findByTestId("issue-row");
		expect(within(row).getByTestId("sparkline")).toBeInTheDocument();
	});

	it("el detalle del issue muestra su propio gráfico", async () => {
		const issue = fx.issue();
		renderApp(`${ISSUES_PATH}/${issue.id}`);
		const card = await screen.findByTestId("trend-card");
		expect(await within(card).findByTestId("bar-chart")).toBeInTheDocument();
		expect(statsService.issue).toHaveBeenCalledWith(
			expect.any(String),
			expect.any(String),
			issue.id,
			"24h",
		);
	});
});
