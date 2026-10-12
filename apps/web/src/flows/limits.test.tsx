import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { projectsService } from "@/services/projectsService/projectsService";
import * as fx from "@/test/fixtures";
import {
	ISSUES_PATH,
	mockHappyPath,
	renderApp,
	settingsSection,
} from "@/test/render-app";

vi.mock("@/services/authService/authService");
vi.mock("@/services/configService/configService");
vi.mock("@/services/organizationsService/organizationsService");
vi.mock("@/services/projectsService/projectsService");
vi.mock("@/services/issuesService/issuesService");

beforeEach(() => {
	vi.resetAllMocks();
	mockHappyPath();
});

describe("datos y límites", () => {
	it("muestra lo consumido este mes, con barra solo cuando hay límite", async () => {
		vi.mocked(projectsService.usage).mockResolvedValue(
			fx.usage({
				events: { used: 8_500, quota: 10_000 },
				transactions: { used: 5_320, quota: null },
			}),
		);
		renderApp(settingsSection("limits"));
		const panel = await screen.findByTestId("usage-panel");
		const [events, transactions] =
			await within(panel).findAllByTestId("usage-meter");
		expect(events).toHaveTextContent("8,500 of 10,000");
		expect(events).toHaveAttribute("data-state", "warning"); // 85 %: ya avisa
		expect(within(events).getByRole("progressbar")).toHaveAttribute(
			"aria-valuenow",
			"8500",
		);
		expect(transactions).toHaveTextContent("5,320 (no limit)");
		expect(
			within(transactions).queryByRole("progressbar"),
		).not.toBeInTheDocument();
		expect(panel).toHaveTextContent("Counters reset on");
	});

	it("la barra pasa a rojo al llegar al límite y nunca se sale de la caja", async () => {
		vi.mocked(projectsService.usage).mockResolvedValue(
			fx.usage({ events: { used: 10_050, quota: 10_000 } }),
		);
		renderApp(settingsSection("limits"));
		const [events] = await screen.findAllByTestId("usage-meter");
		expect(events).toHaveAttribute("data-state", "exceeded");
		expect(within(events).getByRole("progressbar")).toHaveAttribute(
			"aria-valuenow",
			"10000",
		);
	});

	it("guardar envía la retención y los límites; vacío significa sin límite", async () => {
		vi.mocked(projectsService.update).mockResolvedValue({
			...fx.project,
			retentionDays: 180,
		});
		const { user } = renderApp(settingsSection("limits"));
		const retention = await screen.findByLabelText("Data retention");
		expect(retention).toHaveValue("90");
		await user.selectOptions(retention, "180");
		await user.type(screen.getByLabelText("Monthly events limit"), "50000");
		await user.click(screen.getByRole("button", { name: "Save changes" }));

		await waitFor(() =>
			expect(projectsService.update).toHaveBeenCalledWith(
				expect.any(String),
				fx.project.id,
				{
					retentionDays: 180,
					monthlyEventQuota: 50_000,
					monthlyTransactionQuota: null,
				},
			),
		);
		expect(await screen.findByText("Limits saved.")).toBeInTheDocument();
	});

	it("un límite que no es un entero positivo se rechaza sin enviar nada", async () => {
		const { user } = renderApp(settingsSection("limits"));
		await user.type(
			await screen.findByLabelText("Monthly events limit"),
			"abc",
		);
		await user.type(screen.getByLabelText("Monthly transactions limit"), "0");
		await user.click(screen.getByRole("button", { name: "Save changes" }));
		expect(
			await screen.findAllByText(
				"Enter a whole number of at least 1, or leave it empty.",
			),
		).toHaveLength(2);
		expect(projectsService.update).not.toHaveBeenCalled();
	});

	it("los límites ya guardados aparecen en el formulario", async () => {
		vi.mocked(projectsService.get).mockResolvedValue({
			...fx.project,
			retentionDays: 365,
			monthlyEventQuota: 2_000,
		});
		renderApp(settingsSection("limits"));
		expect(await screen.findByLabelText("Data retention")).toHaveValue("365");
		expect(screen.getByLabelText("Monthly events limit")).toHaveValue("2000");
		expect(screen.getByLabelText("Monthly transactions limit")).toHaveValue("");
	});
});

describe("aviso de cuota agotada", () => {
	it("en issues y en rendimiento avisa de qué se está rechazando y hasta cuándo", async () => {
		vi.mocked(projectsService.usage).mockResolvedValue(
			fx.usage({
				events: { used: 1_000, quota: 1_000 },
				transactions: { used: 10, quota: 5_000 },
			}),
		);
		const { unmount } = renderApp(ISSUES_PATH);
		const banner = await screen.findByTestId("quota-banner");
		expect(banner).toHaveTextContent("reached its monthly limit of events");
		expect(banner).not.toHaveTextContent("transactions");
		expect(
			within(banner).getByRole("link", { name: "Manage limits" }),
		).toHaveAttribute("href", expect.stringContaining("/settings"));
		unmount();

		renderApp("/acme/projects/storefront/performance");
		expect(await screen.findByTestId("quota-banner")).toBeInTheDocument();
	});

	it("sin cuota agotada no hay aviso", async () => {
		vi.mocked(projectsService.usage).mockResolvedValue(
			fx.usage({ events: { used: 10, quota: 1_000 } }),
		);
		renderApp(ISSUES_PATH);
		await screen.findAllByTestId("issue-row");
		await waitFor(() => expect(projectsService.usage).toHaveBeenCalled());
		expect(screen.queryByTestId("quota-banner")).not.toBeInTheDocument();
	});
});
