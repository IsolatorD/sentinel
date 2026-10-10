import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { issuesService } from "@/services/issuesService/issuesService";
import * as fx from "@/test/fixtures";
import { ISSUES_PATH, mockHappyPath, renderApp } from "@/test/render-app";
import { ApiError } from "@/utils/apiError/apiError";

vi.mock("@/services/authService/authService");
vi.mock("@/services/configService/configService");
vi.mock("@/services/organizationsService/organizationsService");
vi.mock("@/services/projectsService/projectsService");
vi.mock("@/services/issuesService/issuesService");

beforeEach(() => {
	vi.resetAllMocks();
	mockHappyPath();
});

const lastQuery = () => vi.mocked(issuesService.list).mock.calls.at(-1)?.[2];

describe("listado de issues", () => {
	it("muestra cada issue con título, culprit, nivel y contadores", async () => {
		vi.mocked(issuesService.list).mockResolvedValue(
			fx.issueList([
				fx.issue(),
				fx.issue({
					id: "a2",
					title: "RangeError: Invalid array length",
					culprit: null,
					level: "fatal",
					eventCount: 1200,
					userCount: 3,
				}),
			]),
		);
		renderApp(ISSUES_PATH);

		const rows = await screen.findAllByTestId("issue-row");
		expect(rows).toHaveLength(2);
		expect(within(rows[0]).getByText(fx.issue().title)).toBeInTheDocument();
		expect(
			within(rows[0]).getByText("computeTotal (Cart.js:42)"),
		).toBeInTheDocument();
		expect(within(rows[0]).getByText("Error")).toBeInTheDocument();
		expect(within(rows[0]).getByText("18")).toBeInTheDocument();
		expect(within(rows[1]).getByText("Fatal")).toBeInTheDocument();
		expect(within(rows[1]).getByText("1.2K")).toBeInTheDocument();
	});

	it("por defecto pide los no resueltos, más recientes primero, 25 por página", async () => {
		renderApp(ISSUES_PATH);
		await screen.findByTestId("issue-list");
		expect(lastQuery()).toEqual({
			status: "unresolved",
			level: undefined,
			q: undefined,
			sort: "lastSeen",
			order: "desc",
			limit: 25,
			offset: 0,
		});
	});

	it("los issues resueltos o ignorados llevan su etiqueta de estado", async () => {
		vi.mocked(issuesService.list).mockResolvedValue(
			fx.issueList([fx.issue({ status: "resolved" })]),
		);
		renderApp(`${ISSUES_PATH}?status=all`);
		const row = await screen.findByTestId("issue-row");
		expect(within(row).getByText("Resolved")).toBeInTheDocument();
	});

	it("cada fila enlaza al detalle del issue", async () => {
		const { user, router } = renderApp(ISSUES_PATH);
		await user.click(await screen.findByTestId("issue-row"));
		await waitFor(() =>
			expect(router.state.location.pathname).toBe(
				`${ISSUES_PATH}/${fx.ISSUE_ID}`,
			),
		);
	});
});

describe("filtros", () => {
	it("las pestañas de estado consultan con ese estado y lo reflejan en la URL", async () => {
		const { user, router } = renderApp(ISSUES_PATH);
		await screen.findByTestId("issue-list");

		await user.click(screen.getByRole("tab", { name: "Resolved" }));
		await waitFor(() =>
			expect(lastQuery()).toMatchObject({ status: "resolved", offset: 0 }),
		);
		expect(router.state.location.search).toMatchObject({ status: "resolved" });
		expect(screen.getByRole("tab", { name: "Resolved" })).toHaveAttribute(
			"aria-selected",
			"true",
		);

		// Volver a la pestaña por defecto deja la URL limpia.
		await user.click(screen.getByRole("tab", { name: "Unresolved" }));
		await waitFor(() => expect(router.state.location.search).toEqual({}));
	});

	it("la búsqueda espera a que se termine de escribir y vuelve a la primera página", async () => {
		const { user, router } = renderApp(`${ISSUES_PATH}?page=3`);
		await screen.findByTestId("issue-list");
		vi.mocked(issuesService.list).mockClear();

		await user.type(
			screen.getByPlaceholderText("Search by title or culprit…"),
			"timeout",
		);
		// Una sola consulta con el texto completo, no una por tecla.
		await waitFor(() =>
			expect(lastQuery()).toMatchObject({ q: "timeout", offset: 0 }),
		);
		const withQuery = vi
			.mocked(issuesService.list)
			.mock.calls.filter((c) => c[2].q);
		expect(withQuery).toHaveLength(1);
		expect(router.state.location.search).toMatchObject({ q: "timeout" });
		expect(router.state.location.search).not.toHaveProperty("page");
	});

	it("el campo de búsqueda se rellena desde la URL y se puede limpiar", async () => {
		const { user } = renderApp(`${ISSUES_PATH}?q=timeout`);
		const input = await screen.findByPlaceholderText(
			"Search by title or culprit…",
		);
		expect(input).toHaveValue("timeout");
		await user.click(screen.getByRole("button", { name: "Close" }));
		await waitFor(() => expect(lastQuery()).toMatchObject({ q: undefined }));
		expect(input).toHaveValue("");
	});

	it("cambiar el orden consulta con el criterio y el sentido elegidos", async () => {
		const { user } = renderApp(ISSUES_PATH);
		await screen.findByTestId("issue-list");
		await user.selectOptions(screen.getByLabelText("Sort by"), "events");
		await waitFor(() =>
			expect(lastQuery()).toMatchObject({ sort: "events", order: "desc" }),
		);
		await user.click(screen.getByRole("button", { name: "Descending" }));
		await waitFor(() => expect(lastQuery()).toMatchObject({ order: "asc" }));
	});

	it("una URL con parámetros inválidos no rompe la pantalla", async () => {
		renderApp(`${ISSUES_PATH}?status=borrado&sort=nombre&page=-9&limit=1000`);
		await screen.findByTestId("issue-list");
		expect(lastQuery()).toMatchObject({
			status: "unresolved",
			sort: "lastSeen",
			offset: 0,
			limit: 25,
		});
	});
});

describe("paginación", () => {
	beforeEach(() => {
		vi.mocked(issuesService.list).mockImplementation(async (_o, _p, q) => ({
			items: [fx.issue()],
			total: 60,
			limit: 25,
			offset: q.offset ?? 0,
			trends: {},
		}));
	});

	it("muestra el rango y avanza de página", async () => {
		const { user, router } = renderApp(ISSUES_PATH);
		expect(await screen.findByText("1–25 of 60")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /Previous/ })).toBeDisabled();

		await user.click(screen.getByRole("button", { name: /Next/ }));
		await waitFor(() => expect(lastQuery()).toMatchObject({ offset: 25 }));
		expect(router.state.location.search).toMatchObject({ page: 2 });
		expect(await screen.findByText("26–50 of 60")).toBeInTheDocument();
	});

	it("en la última página no se puede avanzar", async () => {
		renderApp(`${ISSUES_PATH}?page=3`);
		expect(await screen.findByText("51–60 of 60")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /Next/ })).toBeDisabled();
	});
});

describe("estados especiales", () => {
	it("un proyecto sin issues explica qué hacer y enlaza a la instalación", async () => {
		vi.mocked(issuesService.list).mockResolvedValue(fx.issueList([]));
		renderApp(ISSUES_PATH);
		expect(await screen.findByText("No issues yet")).toBeInTheDocument();
		expect(
			screen.getByRole("link", { name: "See how to install the SDK" }),
		).toHaveAttribute("href", "/acme/projects/storefront/settings");
	});

	it("sin resultados con filtros activos, ofrece limpiarlos", async () => {
		vi.mocked(issuesService.list).mockResolvedValue(fx.issueList([]));
		const { user, router } = renderApp(`${ISSUES_PATH}?status=resolved&q=nada`);
		expect(
			await screen.findByText("No issues match your filters"),
		).toBeInTheDocument();

		await user.click(screen.getByRole("button", { name: "Clear filters" }));
		await waitFor(() => expect(router.state.location.search).toEqual({}));
	});

	it("muestra un esqueleto mientras carga", async () => {
		vi.mocked(issuesService.list).mockReturnValue(new Promise(() => {}));
		renderApp(ISSUES_PATH);
		expect(await screen.findByTestId("issue-list-loading")).toBeInTheDocument();
	});

	it("si falla la carga, muestra el error y permite reintentar", async () => {
		vi.mocked(issuesService.list).mockRejectedValueOnce(
			new ApiError(500, "boom"),
		);
		const { user } = renderApp(ISSUES_PATH);
		expect(
			await screen.findByText("Could not load the issues."),
		).toBeInTheDocument();
		await user.click(screen.getByRole("button", { name: "Try again" }));
		expect(await screen.findByTestId("issue-list")).toBeInTheDocument();
	});
});
