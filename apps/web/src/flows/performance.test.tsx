import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { performanceService } from "@/services/performanceService/performanceService";
import * as fx from "@/test/fixtures";
import { mockHappyPath, renderApp } from "@/test/render-app";

vi.mock("@/services/authService/authService");
vi.mock("@/services/configService/configService");
vi.mock("@/services/organizationsService/organizationsService");
vi.mock("@/services/projectsService/projectsService");
vi.mock("@/services/issuesService/issuesService");

const PERFORMANCE_PATH = "/acme/projects/storefront/performance";
const lastTransactionsQuery = () =>
	vi.mocked(performanceService.transactions).mock.calls.at(-1)?.[2];

beforeEach(() => {
	vi.resetAllMocks();
	mockHappyPath();
});

describe("rendimiento: lista", () => {
	it("el menú lleva a la pantalla y muestra el resumen, el gráfico, los Web Vitals y la tabla", async () => {
		const { user } = renderApp("/acme/projects/storefront/issues");
		await user.click(await screen.findByRole("link", { name: "Performance" }));

		const overview = await screen.findByTestId("performance-overview");
		expect(
			await within(overview).findByTestId("latency-chart"),
		).toBeInTheDocument();
		expect(within(overview).getByText("2.4 s")).toBeInTheDocument(); // p95
		expect(within(overview).getByText("3.8%")).toBeInTheDocument(); // errores

		const vitals = screen.getByTestId("web-vitals");
		expect(within(vitals).getAllByTestId("vital-card")).toHaveLength(2);
		expect(within(vitals).getByText("Good")).toBeInTheDocument();
		expect(within(vitals).getByText("Poor")).toBeInTheDocument();

		const rows = await screen.findAllByTestId("transaction-row");
		expect(rows).toHaveLength(2);
		expect(within(rows[0]).getByText("/checkout")).toBeInTheDocument();
		expect(within(rows[0]).getByText("640 ms")).toBeInTheDocument();
		expect(within(rows[0]).getByText("5%")).toBeInTheDocument();
	});

	it("cambiar de periodo, buscar y ordenar consultan con esos valores", async () => {
		const { user } = renderApp(PERFORMANCE_PATH);
		await screen.findAllByTestId("transaction-row");
		const filters = screen.getByTestId("performance-filters");

		await user.click(within(filters).getByRole("button", { name: "7 days" }));
		await waitFor(() =>
			expect(lastTransactionsQuery()).toMatchObject({ period: "7d" }),
		);
		expect(
			vi.mocked(performanceService.overview).mock.calls.at(-1)?.[2],
		).toMatchObject({
			period: "7d",
		});

		await user.type(within(filters).getByRole("searchbox"), "check");
		await waitFor(() =>
			expect(lastTransactionsQuery()).toMatchObject({ q: "check" }),
		);

		await user.click(screen.getByRole("button", { name: "p95" }));
		await waitFor(() =>
			expect(lastTransactionsQuery()).toMatchObject({
				sort: "p95",
				order: "desc",
			}),
		);
		await user.click(screen.getByRole("button", { name: "p95" }));
		await waitFor(() =>
			expect(lastTransactionsQuery()).toMatchObject({ order: "asc" }),
		);
	});

	it("el estado vacío invita a activar el rendimiento en el SDK", async () => {
		vi.mocked(performanceService.transactions).mockResolvedValue(
			fx.transactionList([]),
		);
		vi.mocked(performanceService.overview).mockResolvedValue(
			fx.overview({
				summary: {
					count: 0,
					p50: null,
					p95: null,
					p99: null,
					errorRate: 0,
					tpm: 0,
				},
				vitals: {},
				points: [],
			}),
		);
		renderApp(PERFORMANCE_PATH);
		expect(await screen.findByText("No transactions yet")).toBeInTheDocument();
		expect(
			screen.getByText("No transactions in this period."),
		).toBeInTheDocument();
		expect(screen.queryByTestId("web-vitals")).not.toBeInTheDocument();
	});

	it("si falla la carga de la tabla ofrece reintentar", async () => {
		vi.mocked(performanceService.transactions).mockRejectedValueOnce(
			new Error("boom"),
		);
		const { user } = renderApp(PERFORMANCE_PATH);
		expect(
			await screen.findByText("Couldn't load the transactions."),
		).toBeInTheDocument();
		await user.click(screen.getByRole("button", { name: "Try again" }));
		expect(await screen.findAllByTestId("transaction-row")).toHaveLength(2);
	});
});

describe("rendimiento: transacción y cascada", () => {
	it("abrir una transacción muestra su resumen y sus ejemplos más lentos", async () => {
		const { user } = renderApp(PERFORMANCE_PATH);
		const rows = await screen.findAllByTestId("transaction-row");
		await user.click(within(rows[0]).getByRole("link", { name: "/checkout" }));

		expect(
			await screen.findByRole("heading", { name: "/checkout" }),
		).toBeInTheDocument();
		await waitFor(() =>
			expect(
				vi.mocked(performanceService.overview).mock.calls.at(-1)?.[2],
			).toMatchObject({
				name: "/checkout",
			}),
		);
		// En el detalle de una transacción no se repiten los Web Vitals del proyecto.
		expect(screen.queryByTestId("web-vitals")).not.toBeInTheDocument();

		const samples = await screen.findAllByTestId("sample-row");
		expect(samples).toHaveLength(2);
		expect(
			vi.mocked(performanceService.samples).mock.calls.at(-1)?.[2],
		).toMatchObject({
			name: "/checkout",
			sort: "slowest",
		});

		await user.click(screen.getByRole("tab", { name: "Most recent" }));
		await waitFor(() =>
			expect(
				vi.mocked(performanceService.samples).mock.calls.at(-1)?.[2],
			).toMatchObject({
				sort: "recent",
			}),
		);
	});

	it("abrir un ejemplo dibuja la cascada de spans con su anidación", async () => {
		const { user } = renderApp(
			"/acme/projects/storefront/performance/transaction?name=%2Fcheckout",
		);
		const samples = await screen.findAllByTestId("sample-row");
		await user.click(within(samples[0]).getByRole("link"));

		const waterfall = await screen.findByTestId("span-waterfall");
		const rows = within(waterfall).getAllByTestId("span-row");
		expect(rows).toHaveLength(3); // la transacción y sus 2 spans
		expect(rows.map((r) => r.dataset.depth)).toEqual(["0", "1", "2"]);
		expect(within(rows[1]).getByText("GET /api/cart")).toBeInTheDocument();
		expect(within(rows[2]).getByText("300 ms")).toBeInTheDocument();

		const summary = screen.getByTestId("sample-summary");
		expect(within(summary).getByText("3.8 s")).toBeInTheDocument();
		expect(within(summary).getByText("2.1 s")).toBeInTheDocument(); // LCP formateado
		expect(summary).toHaveTextContent(fx.sample().traceId);
	});

	it("una transacción sin spans lo explica", async () => {
		vi.mocked(performanceService.sample).mockResolvedValue(
			fx.sampleDetail({ spans: [] }),
		);
		renderApp(
			`/acme/projects/storefront/performance/samples/${fx.sample().id}`,
		);
		expect(
			await screen.findByText(
				/has no spans: only its total duration was measured/,
			),
		).toBeInTheDocument();
		expect(screen.getAllByTestId("span-row")).toHaveLength(1);
	});

	it("sin nombre en la URL se muestra la página no encontrada", async () => {
		renderApp("/acme/projects/storefront/performance/transaction");
		expect(await screen.findByText(/not found/i)).toBeInTheDocument();
	});
});
