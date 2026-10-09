import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { issuesService } from "@/services/issuesService/issuesService";
import { releasesService } from "@/services/releasesService/releasesService";
import * as fx from "@/test/fixtures";
import {
	ISSUE_PATH,
	ISSUES_PATH,
	mockHappyPath,
	renderApp,
} from "@/test/render-app";
import { ApiError } from "@/utils/apiError/apiError";

vi.mock("@/services/authService/authService");
vi.mock("@/services/configService/configService");
vi.mock("@/services/organizationsService/organizationsService");
vi.mock("@/services/projectsService/projectsService");
vi.mock("@/services/issuesService/issuesService");
vi.mock("@/services/releasesService/releasesService");

const release = (version: string, over = {}) => ({
	version,
	createdAt: new Date(Date.now() - 3600_000).toISOString(),
	eventCount: 12,
	newIssueCount: 3,
	artifactCount: 0,
	firstEventAt: null,
	lastEventAt: null,
	...over,
});

beforeEach(() => {
	vi.resetAllMocks();
	mockHappyPath();
	vi.mocked(releasesService.list).mockResolvedValue([
		release("2.4.0"),
		release("2.3.0", { newIssueCount: 0 }),
	]);
	vi.mocked(releasesService.environments).mockResolvedValue([
		"production",
		"staging",
	]);
});

const lastQuery = () => vi.mocked(issuesService.list).mock.calls.at(-1)?.[2];

describe("página de releases", () => {
	it("lista las releases con sus contadores y enlaza a los issues nuevos de cada una", async () => {
		const { user, router } = renderApp("/acme/projects/storefront/releases");
		const rows = await screen.findAllByTestId("release-row");
		expect(rows).toHaveLength(2);
		expect(within(rows[0]).getByText("2.4.0")).toBeInTheDocument();
		expect(within(rows[0]).getByText("12")).toBeInTheDocument();

		await user.click(within(rows[0]).getByRole("link", { name: "3" }));
		await waitFor(() =>
			expect(router.state.location.pathname).toBe(ISSUES_PATH),
		);
		expect(router.state.location.search).toMatchObject({
			release: "2.4.0",
			status: "all",
		});
		await waitFor(() =>
			expect(lastQuery()).toMatchObject({ release: "2.4.0", status: "all" }),
		);
	});

	it("una release sin issues nuevos no es un enlace", async () => {
		renderApp("/acme/projects/storefront/releases");
		const rows = await screen.findAllByTestId("release-row");
		expect(within(rows[1]).queryByRole("link")).not.toBeInTheDocument();
	});

	it("sin releases explica cómo registrar una", async () => {
		vi.mocked(releasesService.list).mockResolvedValue([]);
		renderApp("/acme/projects/storefront/releases");
		expect(await screen.findByText("No releases yet")).toBeInTheDocument();
	});

	it("eliminar una release pide confirmación", async () => {
		vi.mocked(releasesService.remove).mockResolvedValue(undefined);
		const { user } = renderApp("/acme/projects/storefront/releases");
		await user.click(
			await screen.findByRole("button", { name: "Delete 2.4.0" }),
		);
		const dialog = await screen.findByRole("dialog");
		expect(
			within(dialog).getByText("Delete release 2.4.0?"),
		).toBeInTheDocument();
		expect(releasesService.remove).not.toHaveBeenCalled();
		await user.click(within(dialog).getByRole("button", { name: "Delete" }));
		expect(releasesService.remove).toHaveBeenCalledWith(
			"org-1",
			fx.PROJECT_ID,
			"2.4.0",
		);
	});

	it("sin permisos muestra un mensaje claro", async () => {
		vi.mocked(releasesService.remove).mockRejectedValue(
			new ApiError(403, "Insufficient permissions"),
		);
		const { user } = renderApp("/acme/projects/storefront/releases");
		await user.click(
			await screen.findByRole("button", { name: "Delete 2.4.0" }),
		);
		await user.click(
			within(await screen.findByRole("dialog")).getByRole("button", {
				name: "Delete",
			}),
		);
		expect(
			await screen.findByText("Only owners and admins can delete releases."),
		).toBeInTheDocument();
	});

	it("el menú lateral enlaza a las releases", async () => {
		const { user, router } = renderApp(ISSUES_PATH);
		await user.click(await screen.findByRole("link", { name: "Releases" }));
		await waitFor(() =>
			expect(router.state.location.pathname).toBe(
				"/acme/projects/storefront/releases",
			),
		);
	});
});

describe("filtros por entorno y release", () => {
	it("ofrece los entornos y las releases conocidos y consulta con el elegido", async () => {
		const { user, router } = renderApp(ISSUES_PATH);
		await screen.findByTestId("issue-list");

		await user.selectOptions(screen.getByLabelText("Environment"), "staging");
		await waitFor(() =>
			expect(lastQuery()).toMatchObject({ environment: "staging", offset: 0 }),
		);
		expect(router.state.location.search).toMatchObject({
			environment: "staging",
		});

		await user.selectOptions(screen.getByLabelText("Release"), "2.3.0");
		await waitFor(() =>
			expect(lastQuery()).toMatchObject({
				environment: "staging",
				release: "2.3.0",
			}),
		);

		await user.selectOptions(screen.getByLabelText("Environment"), "");
		await waitFor(() => expect(lastQuery()?.environment).toBeUndefined());
	});

	it("un filtro de la URL que ya no está en las listas se conserva como opción", async () => {
		renderApp(`${ISSUES_PATH}?release=1.0.0-borrada`);
		const select = (await screen.findByLabelText(
			"Release",
		)) as HTMLSelectElement;
		expect(select.value).toBe("1.0.0-borrada");
	});

	it("'limpiar filtros' también quita entorno y release", async () => {
		vi.mocked(issuesService.list).mockResolvedValue(fx.issueList([]));
		const { user, router } = renderApp(
			`${ISSUES_PATH}?environment=production&release=2.4.0`,
		);
		await user.click(
			await screen.findByRole("button", { name: "Clear filters" }),
		);
		await waitFor(() => expect(router.state.location.search).toEqual({}));
	});
});

describe("resolver ligado a una release", () => {
	it("el menú ofrece resolver en la próxima release y en la actual", async () => {
		const { user } = renderApp(ISSUE_PATH);
		await user.click(
			await screen.findByRole("button", { name: "More ways to resolve" }),
		);
		await user.click(
			await screen.findByRole("menuitem", { name: "In the next release" }),
		);
		expect(issuesService.updateStatus).toHaveBeenLastCalledWith(
			"org-1",
			fx.PROJECT_ID,
			fx.ISSUE_ID,
			{
				status: "resolved",
				resolution: { type: "next_release" },
			},
		);

		await user.click(
			await screen.findByRole("button", { name: "More ways to resolve" }),
		);
		await user.click(await screen.findByRole("menuitem", { name: "In 2.4.0" }));
		expect(issuesService.updateStatus).toHaveBeenLastCalledWith(
			"org-1",
			fx.PROJECT_ID,
			fx.ISSUE_ID,
			{
				status: "resolved",
				resolution: { type: "release", release: "2.4.0" },
			},
		);
	});

	it("el botón principal resuelve sin ligarlo a ninguna release", async () => {
		const { user } = renderApp(ISSUE_PATH);
		await user.click(await screen.findByRole("button", { name: "Resolve" }));
		const call = vi.mocked(issuesService.updateStatus).mock.calls.at(-1);
		expect(call?.[3]).toMatchObject({ status: "resolved" });
		expect(call?.[3].resolution).toBeUndefined();
	});

	it("un issue resuelto en la próxima release lo explica", async () => {
		vi.mocked(issuesService.get).mockResolvedValue(
			fx.issueDetail({
				status: "resolved",
				resolvedRelease: "2.4.0",
				resolvedInclusive: false,
			}),
		);
		renderApp(ISSUE_PATH);
		expect(
			await screen.findByText("Resolved in the next release (after 2.4.0)"),
		).toBeInTheDocument();
	});

	it("un issue resuelto en una release concreta lo explica", async () => {
		vi.mocked(issuesService.get).mockResolvedValue(
			fx.issueDetail({
				status: "resolved",
				resolvedRelease: "2.5.0",
				resolvedInclusive: true,
			}),
		);
		renderApp(ISSUE_PATH);
		expect(await screen.findByText("Resolved in 2.5.0")).toBeInTheDocument();
	});
});

describe("regresiones", () => {
	const regressed = {
		regressedAt: new Date().toISOString(),
		regressedInRelease: "2.5.0",
	};

	it("el detalle marca la regresión y en qué release ocurrió", async () => {
		vi.mocked(issuesService.get).mockResolvedValue(fx.issueDetail(regressed));
		renderApp(ISSUE_PATH);
		expect(await screen.findByTestId("regression-badge")).toHaveTextContent(
			"Regression",
		);
		expect(
			screen.getByText("This issue was resolved and happened again in 2.5.0."),
		).toBeInTheDocument();
	});

	it("la lista muestra la insignia solo en los issues reabiertos solos", async () => {
		vi.mocked(issuesService.list).mockResolvedValue(
			fx.issueList([
				fx.issue({ ...regressed }),
				fx.issue({ id: "otro", title: "Otro issue" }),
			]),
		);
		renderApp(ISSUES_PATH);
		const rows = await screen.findAllByTestId("issue-row");
		expect(within(rows[0]).getByText("Regression")).toBeInTheDocument();
		expect(within(rows[1]).queryByText("Regression")).not.toBeInTheDocument();
	});

	it("un issue resuelto no muestra la insignia aunque conserve el dato", async () => {
		vi.mocked(issuesService.get).mockResolvedValue(
			fx.issueDetail({ ...regressed, status: "resolved" }),
		);
		renderApp(ISSUE_PATH);
		await screen.findByTestId("issue-header");
		expect(screen.queryByTestId("regression-badge")).not.toBeInTheDocument();
	});

	it("el detalle muestra la primera y la última release", async () => {
		renderApp(ISSUE_PATH);
		const header = await screen.findByTestId("issue-header");
		expect(within(header).getByText("2.3.0")).toBeInTheDocument();
		expect(within(header).getByText("2.4.0")).toBeInTheDocument();
	});
});
