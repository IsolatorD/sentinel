import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api-error";
import { issuesService } from "@/services/issues.service";
import * as fx from "@/test/fixtures";
import {
	ISSUE_PATH,
	ISSUES_PATH,
	mockHappyPath,
	renderApp,
} from "@/test/render-app";

vi.mock("@/services/auth.service");
vi.mock("@/services/config.service");
vi.mock("@/services/organizations.service");
vi.mock("@/services/projects.service");
vi.mock("@/services/issues.service");

beforeEach(() => {
	vi.resetAllMocks();
	mockHappyPath();
});

describe("detalle de un issue", () => {
	it("muestra título, culprit, estado y contadores", async () => {
		renderApp(ISSUE_PATH);
		const header = await screen.findByTestId("issue-header");
		expect(
			within(header).getByRole("heading", { name: fx.issue().title }),
		).toBeInTheDocument();
		expect(
			within(header).getByText("computeTotal (Cart.js:42)"),
		).toBeInTheDocument();
		expect(within(header).getByText("Unresolved")).toBeInTheDocument();
		expect(within(header).getByText("18")).toBeInTheDocument();
		expect(within(header).getByText("7")).toBeInTheDocument();
	});

	it("el stack trace muestra primero la excepción principal y después su causa", async () => {
		renderApp(ISSUE_PATH);
		const blocks = await screen.findAllByTestId("exception-block");
		expect(blocks).toHaveLength(2);
		expect(within(blocks[0]).getByText("TypeError")).toBeInTheDocument();
		expect(within(blocks[1]).getByText("Caused by")).toBeInTheDocument();
		expect(
			within(blocks[1]).getByText(/Card processor timeout/),
		).toBeInTheDocument();
	});

	it("muestra solo tu código y permite ver el resto de los frames", async () => {
		const { user } = renderApp(ISSUE_PATH);
		const main = (await screen.findAllByTestId("exception-block"))[0];

		// Donde se lanzó el error, primero.
		const frames = within(main).getAllByRole("listitem");
		expect(frames.map((f) => f.textContent)).toEqual([
			"Cart.js:42:17 in computeTotal",
			"Cart.js:88:10 in CartPage",
		]);
		expect(within(main).queryByText(/beginWork/)).not.toBeInTheDocument();

		await user.click(
			within(main).getByRole("button", { name: "Show 1 more frames" }),
		);
		expect(within(main).getAllByRole("listitem")).toHaveLength(3);
		expect(within(main).getByText(/beginWork/)).toBeInTheDocument();
		await user.click(
			within(main).getByRole("button", { name: "Show only your code" }),
		);
		expect(within(main).getAllByRole("listitem")).toHaveLength(2);
	});

	it("marca los frames del código propio", async () => {
		renderApp(ISSUE_PATH);
		const main = (await screen.findAllByTestId("exception-block"))[0];
		for (const frame of within(main).getAllByRole("listitem"))
			expect(frame).toHaveAttribute("data-in-app", "true");
	});

	it("los breadcrumbs van del más reciente al más antiguo y resumen las peticiones", async () => {
		renderApp(ISSUE_PATH);
		const crumbs = within(
			await screen.findByTestId("breadcrumbs"),
		).getAllByRole("listitem");
		expect(crumbs).toHaveLength(3);
		expect(crumbs[0]).toHaveTextContent(
			"POST https://shop.acme.dev/api/pay [500]",
		);
		expect(crumbs[1]).toHaveTextContent("button.checkout");
		expect(crumbs[2]).toHaveTextContent(
			"https://shop.acme.dev/ → https://shop.acme.dev/cart",
		);
	});

	it("muestra el contexto del evento y sus tags", async () => {
		renderApp(ISSUE_PATH);
		await screen.findByTestId("breadcrumbs");
		for (const text of [
			"2.4.0",
			"production",
			"user_103",
			"user_103@example.com",
			"Chrome 126.0.0",
			"macOS",
			"https://shop.acme.dev/cart",
		]) {
			expect(screen.getByText(text)).toBeInTheDocument();
		}
		expect(screen.getByText("feature")).toBeInTheDocument();
		expect(screen.getByText("checkout")).toBeInTheDocument();
	});

	it("un payload con formato inesperado se muestra sin procesar en vez de romper la pantalla", async () => {
		vi.mocked(issuesService.get).mockResolvedValue(
			fx.issueDetail({
				latestEvent: fx.event({
					payload: { level: "nope", exception: { values: [] } },
				}),
			}),
		);
		renderApp(ISSUE_PATH);
		expect(await screen.findByText(/unexpected format/)).toBeInTheDocument();
		expect(screen.getByText(/"level": "nope"/)).toBeInTheDocument();
	});

	it("un issue inexistente muestra 'no encontrada'", async () => {
		vi.mocked(issuesService.get).mockRejectedValue(
			new ApiError(404, "Issue not found"),
		);
		renderApp(ISSUE_PATH);
		expect(
			await screen.findByRole("heading", { name: "Page not found" }),
		).toBeInTheDocument();
	});

	it("otro error de carga permite reintentar", async () => {
		vi.mocked(issuesService.get).mockRejectedValueOnce(
			new ApiError(500, "boom"),
		);
		const { user } = renderApp(ISSUE_PATH);
		expect(
			await screen.findByText("Could not load the issue."),
		).toBeInTheDocument();
		await user.click(screen.getByRole("button", { name: "Try again" }));
		expect(await screen.findByTestId("issue-header")).toBeInTheDocument();
	});
});

describe("acciones", () => {
	it("resolver cambia el estado y el botón pasa a 'Reabrir'", async () => {
		vi.mocked(issuesService.get)
			.mockResolvedValueOnce(fx.issueDetail())
			.mockResolvedValue(fx.issueDetail({ status: "resolved" }));
		const { user } = renderApp(ISSUE_PATH);

		await user.click(await screen.findByRole("button", { name: "Resolve" }));
		expect(issuesService.updateStatus).toHaveBeenCalledWith(
			"org-1",
			fx.PROJECT_ID,
			fx.ISSUE_ID,
			"resolved",
		);
		expect(
			await screen.findByRole("button", { name: "Reopen" }),
		).toBeInTheDocument();
		expect(screen.getByText("Resolved")).toBeInTheDocument();
	});

	it("ignorar y reabrir llaman al servicio con el estado correcto", async () => {
		vi.mocked(issuesService.get)
			.mockResolvedValueOnce(fx.issueDetail())
			.mockResolvedValue(fx.issueDetail({ status: "ignored" }));
		const { user } = renderApp(ISSUE_PATH);
		await user.click(await screen.findByRole("button", { name: "Ignore" }));
		expect(issuesService.updateStatus).toHaveBeenLastCalledWith(
			"org-1",
			fx.PROJECT_ID,
			fx.ISSUE_ID,
			"ignored",
		);

		await user.click(await screen.findByRole("button", { name: "Reopen" }));
		expect(issuesService.updateStatus).toHaveBeenLastCalledWith(
			"org-1",
			fx.PROJECT_ID,
			fx.ISSUE_ID,
			"unresolved",
		);
	});

	it("eliminar pide confirmación y vuelve al listado", async () => {
		const { user, router } = renderApp(ISSUE_PATH);
		await user.click(await screen.findByRole("button", { name: "Delete" }));
		const dialog = await screen.findByRole("dialog");
		expect(within(dialog).getByText("Delete this issue?")).toBeInTheDocument();
		expect(issuesService.remove).not.toHaveBeenCalled();

		await user.click(within(dialog).getByRole("button", { name: "Delete" }));
		expect(issuesService.remove).toHaveBeenCalledWith(
			"org-1",
			fx.PROJECT_ID,
			fx.ISSUE_ID,
		);
		await waitFor(() =>
			expect(router.state.location.pathname).toBe(ISSUES_PATH),
		);
	});

	it("cancelar la confirmación no elimina nada", async () => {
		const { user } = renderApp(ISSUE_PATH);
		await user.click(await screen.findByRole("button", { name: "Delete" }));
		await user.click(
			within(await screen.findByRole("dialog")).getByRole("button", {
				name: "Cancel",
			}),
		);
		await waitFor(() =>
			expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
		);
		expect(issuesService.remove).not.toHaveBeenCalled();
	});
});

describe("eventos del issue", () => {
	it("navega entre ocurrencias con Anterior, Siguiente y Último", async () => {
		const older = fx.event({
			id: fx.OLDER_EVENT_ID,
			timestamp: new Date(Date.now() - 3600_000).toISOString(),
		});
		vi.mocked(issuesService.getEvent).mockResolvedValue(older);
		const { user, router } = renderApp(ISSUE_PATH);

		const nav = await screen.findByTestId("event-navigator");
		expect(within(nav).getByText(/Event 44444444/)).toBeInTheDocument();
		expect(within(nav).getByRole("button", { name: /Latest/ })).toBeDisabled();
		expect(within(nav).getByRole("button", { name: /Newer/ })).toBeDisabled();

		await user.click(within(nav).getByRole("button", { name: /Older/ }));
		await waitFor(() =>
			expect(router.state.location.search).toMatchObject({
				event: fx.OLDER_EVENT_ID,
			}),
		);
		expect(issuesService.getEvent).toHaveBeenCalledWith(
			"org-1",
			fx.PROJECT_ID,
			fx.ISSUE_ID,
			fx.OLDER_EVENT_ID,
		);
		expect(await screen.findByText(/Event 55555555/)).toBeInTheDocument();

		await user.click(screen.getByRole("button", { name: /Latest/ }));
		await waitFor(() => expect(router.state.location.search).toEqual({}));
		expect(await screen.findByText(/Event 44444444/)).toBeInTheDocument();
	});

	it("la pestaña de eventos lista las ocurrencias y permite abrir una", async () => {
		const { user, router } = renderApp(`${ISSUE_PATH}?tab=events`);
		const table = await screen.findByTestId("events-table");
		// Mientras carga hay filas de esqueleto: se espera a los datos reales.
		await waitFor(() =>
			expect(within(table).getAllByRole("row")).toHaveLength(3),
		);
		const rows = within(table).getAllByRole("row").slice(1);
		expect(rows[0]).toHaveTextContent("user_103");

		await user.click(within(rows[1]).getByRole("button", { name: "View" }));
		await waitFor(() =>
			expect(router.state.location.search).toMatchObject({
				event: fx.OLDER_EVENT_ID,
			}),
		);
		expect(router.state.location.search).not.toHaveProperty("tab");
		expect(await screen.findByTestId("event-navigator")).toBeInTheDocument();
	});

	it("cambiar de pestaña actualiza la URL", async () => {
		const { user, router } = renderApp(ISSUE_PATH);
		await user.click(await screen.findByRole("tab", { name: "Events" }));
		await waitFor(() =>
			expect(router.state.location.search).toMatchObject({ tab: "events" }),
		);
		expect(await screen.findByTestId("events-table")).toBeInTheDocument();
	});
});
