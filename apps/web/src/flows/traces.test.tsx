import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { issuesService } from "@/services/issuesService/issuesService";
import { performanceService } from "@/services/performanceService/performanceService";
import * as fx from "@/test/fixtures";
import { ISSUE_PATH, mockHappyPath, renderApp } from "@/test/render-app";
import { ApiError } from "@/utils/apiError/apiError";

vi.mock("@/services/authService/authService");
vi.mock("@/services/configService/configService");
vi.mock("@/services/organizationsService/organizationsService");
vi.mock("@/services/projectsService/projectsService");
vi.mock("@/services/issuesService/issuesService");

const TRACE_PATH = `/acme/projects/storefront/performance/traces/${fx.TRACE_ID}`;

beforeEach(() => {
	vi.resetAllMocks();
	mockHappyPath();
});

describe("error ↔ traza", () => {
	it("un error con traza ofrece verla; sin traza, no", async () => {
		vi.mocked(issuesService.get).mockResolvedValue(
			fx.issueDetail({ latestEvent: fx.event({ traceId: fx.TRACE_ID }) }),
		);
		const { unmount } = renderApp(ISSUE_PATH);
		expect(await screen.findByTestId("view-trace")).toHaveAttribute(
			"href",
			expect.stringContaining(`/performance/traces/${fx.TRACE_ID}`),
		);
		unmount();

		vi.mocked(issuesService.get).mockResolvedValue(fx.issueDetail());
		renderApp(ISSUE_PATH);
		await screen.findByText("Stack trace");
		expect(screen.queryByTestId("view-trace")).not.toBeInTheDocument();
	});

	it("desde el error se llega a la traza, con el servidor anidado bajo el navegador y los errores", async () => {
		vi.mocked(issuesService.get).mockResolvedValue(
			fx.issueDetail({ latestEvent: fx.event({ traceId: fx.TRACE_ID }) }),
		);
		const { user, router } = renderApp(ISSUE_PATH);
		await user.click(await screen.findByTestId("view-trace"));

		await waitFor(() =>
			expect(router.state.location.pathname).toContain("/performance/traces/"),
		);
		expect(performanceService.trace).toHaveBeenCalledWith(
			expect.any(String),
			expect.any(String),
			fx.TRACE_ID,
		);

		const rows = await screen.findAllByTestId("trace-row");
		expect(rows.map((r) => r.dataset.depth)).toEqual(["0", "1"]);
		expect(within(rows[0]).getByText("/checkout")).toBeInTheDocument();
		expect(within(rows[0]).getByText("javascript")).toBeInTheDocument();
		expect(within(rows[1]).getByText("POST /api/orders")).toBeInTheDocument();
		expect(within(rows[1]).getByText("node")).toBeInTheDocument();
		expect(within(rows[1]).getByText("internal_error")).toBeInTheDocument();
		expect(within(rows[1]).getByText("1")).toBeInTheDocument(); // un error en esta transacción

		const errors = screen.getAllByTestId("trace-error");
		expect(errors).toHaveLength(2);
		expect(
			within(errors[0]).getByRole("link", {
				name: "PaymentError: card declined",
			}),
		).toHaveAttribute(
			"href",
			expect.stringContaining(
				"/issues/a1?event=e1e1e1e1-1111-4a2b-8c3d-aaaaaaaaaaaa",
			),
		);
	});

	it("cada transacción de la traza abre su cascada", async () => {
		const { user, router } = renderApp(TRACE_PATH);
		const rows = await screen.findAllByTestId("trace-row");
		await user.click(
			within(rows[1]).getByRole("link", { name: "POST /api/orders" }),
		);
		await waitFor(() =>
			expect(router.state.location.pathname).toContain(
				`/performance/samples/${fx.SERVER_TX}`,
			),
		);
	});

	it("una traza sin errores lo dice", async () => {
		vi.mocked(performanceService.trace).mockResolvedValue(
			fx.trace({ events: [] }),
		);
		renderApp(TRACE_PATH);
		expect(
			await screen.findByText("No errors were captured during this trace."),
		).toBeInTheDocument();
	});

	it("una traza inexistente muestra la página no encontrada", async () => {
		vi.mocked(performanceService.trace).mockRejectedValue(
			new ApiError(404, "Not found", "NOT_FOUND"),
		);
		renderApp(TRACE_PATH);
		expect(await screen.findByText(/not found/i)).toBeInTheDocument();
	});

	it("si falla la carga, ofrece reintentar", async () => {
		vi.mocked(performanceService.trace)
			.mockRejectedValueOnce(new Error("boom"))
			.mockResolvedValue(fx.trace());
		const { user } = renderApp(TRACE_PATH);
		expect(
			await screen.findByText("Couldn't load this trace."),
		).toBeInTheDocument();
		await user.click(screen.getByRole("button", { name: "Try again" }));
		expect(await screen.findByTestId("trace-timeline")).toBeInTheDocument();
	});
});

describe("transacción ↔ traza", () => {
	const SAMPLE_PATH = `/acme/projects/storefront/performance/samples/${fx.sample().id}`;

	it("si la traza tiene más servicios o errores, el ejemplo lo resume y enlaza", async () => {
		renderApp(SAMPLE_PATH);
		const box = await screen.findByTestId("sample-trace");
		expect(box).toHaveTextContent(
			"2 transactions and 2 errors in the same trace",
		);
		expect(
			within(box).getByRole("link", { name: "View trace" }),
		).toHaveAttribute(
			"href",
			expect.stringContaining(`/performance/traces/${fx.sample().traceId}`),
		);
	});

	it("si la traza solo tiene esa transacción y ningún error, no muestra nada", async () => {
		vi.mocked(performanceService.trace).mockResolvedValue(
			fx.trace({ transactions: [fx.trace().transactions[0]], events: [] }),
		);
		renderApp(SAMPLE_PATH);
		await screen.findByTestId("span-waterfall");
		await waitFor(() => expect(performanceService.trace).toHaveBeenCalled());
		expect(screen.queryByTestId("sample-trace")).not.toBeInTheDocument();
	});
});
