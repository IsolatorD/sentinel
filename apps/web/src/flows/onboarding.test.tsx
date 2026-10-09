import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { organizationsService } from "@/services/organizationsService/organizationsService";
import { projectsService } from "@/services/projectsService/projectsService";
import * as fx from "@/test/fixtures";
import { mockHappyPath, renderApp } from "@/test/render-app";

vi.mock("@/services/authService/authService");
vi.mock("@/services/configService/configService");
vi.mock("@/services/organizationsService/organizationsService");
vi.mock("@/services/projectsService/projectsService");
vi.mock("@/services/issuesService/issuesService");

beforeEach(() => {
	vi.resetAllMocks();
	mockHappyPath();
	vi.mocked(organizationsService.list).mockResolvedValue([]);
	vi.mocked(organizationsService.create).mockResolvedValue({
		id: "org-new",
		name: "Lucia Studio",
		slug: "lucia-studio-ab12",
		logo: null,
	});
	vi.mocked(projectsService.create).mockResolvedValue({
		...fx.project,
		name: "Portfolio",
		slug: "portfolio",
	});
});

describe("onboarding", () => {
	it("guía paso a paso: organización, proyecto y cómo instalar el SDK con la DSN", async () => {
		const { user, router } = renderApp("/onboarding");

		// 1. Organización
		await user.type(
			await screen.findByLabelText("Organization name"),
			"Lucia Studio",
		);
		await user.click(screen.getByRole("button", { name: "Create" }));
		expect(organizationsService.create).toHaveBeenCalledWith({
			name: "Lucia Studio",
			slug: expect.stringMatching(/^lucia-studio-[a-z0-9]+$/),
		});

		// 2. Proyecto
		await user.type(await screen.findByLabelText("Project name"), "Portfolio");
		await user.selectOptions(screen.getByLabelText("Platform"), "react");
		await user.click(screen.getByRole("button", { name: "Create" }));
		expect(projectsService.create).toHaveBeenCalledWith("org-new", {
			name: "Portfolio",
			platform: "react",
		});

		// 3. Instalación, con la DSN real ya incluida
		expect(
			await screen.findByRole("heading", { name: "Install the SDK" }),
		).toBeInTheDocument();
		expect(
			screen.getByText(/npm install @sentinel\/browser/),
		).toBeInTheDocument();
		expect(
			screen.getByText(
				new RegExp(fx.key.dsn.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
			),
		).toBeInTheDocument();

		await user.click(screen.getByRole("button", { name: "Go to issues" }));
		await waitFor(() =>
			expect(router.state.location.pathname).toBe(
				"/lucia-studio-ab12/projects/portfolio/issues",
			),
		);
		expect(window.localStorage.getItem("sentinel:last-org")).toBe(
			"lucia-studio-ab12",
		);
	});

	it("no permite crear una organización sin nombre", async () => {
		const { user } = renderApp("/onboarding");
		await user.click(await screen.findByRole("button", { name: "Create" }));
		expect(
			await screen.findByText("This field is required."),
		).toBeInTheDocument();
		expect(organizationsService.create).not.toHaveBeenCalled();
	});

	it("si falla la creación muestra un error y permite reintentar", async () => {
		vi.mocked(organizationsService.create).mockRejectedValueOnce(
			new Error("boom"),
		);
		const { user } = renderApp("/onboarding");
		await user.type(await screen.findByLabelText("Organization name"), "Acme");
		await user.click(screen.getByRole("button", { name: "Create" }));
		expect(await screen.findByRole("alert")).toHaveTextContent(
			"Something went wrong",
		);

		await user.click(screen.getByRole("button", { name: "Create" }));
		expect(await screen.findByLabelText("Project name")).toBeInTheDocument();
	});

	it("el paso actual se marca en el indicador de pasos", async () => {
		renderApp("/onboarding");
		const steps = await screen.findByRole("list");
		expect(within(steps).getByText("Organization")).toHaveClass("font-medium");
		expect(within(steps).getByText("Project")).not.toHaveClass("font-medium");
	});
});

describe("proyectos", () => {
	beforeEach(() =>
		vi.mocked(organizationsService.list).mockResolvedValue([fx.org]),
	);

	it("lista los proyectos y crea uno nuevo desde el diálogo", async () => {
		vi.mocked(projectsService.create).mockResolvedValue({
			...fx.project,
			id: "p2",
			name: "Blog",
			slug: "blog",
		});
		const { user, router } = renderApp("/acme/projects");

		expect(await screen.findByText("Storefront")).toBeInTheDocument();
		await user.click(screen.getByRole("button", { name: "Create project" }));
		const dialog = await screen.findByRole("dialog");
		await user.type(within(dialog).getByLabelText("Project name"), "Blog");
		await user.click(within(dialog).getByRole("button", { name: "Create" }));

		expect(projectsService.create).toHaveBeenCalledWith("org-1", {
			name: "Blog",
			platform: "javascript",
		});
		await waitFor(() =>
			expect(router.state.location.pathname).toBe(
				"/acme/projects/blog/settings",
			),
		);
	});

	it("una organización sin proyectos muestra un estado vacío con la acción de crear", async () => {
		vi.mocked(projectsService.list).mockResolvedValue([]);
		renderApp("/acme/projects");
		expect(await screen.findByText("No projects yet")).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Create project" }),
		).toBeInTheDocument();
	});

	it("un error al cargar permite reintentar", async () => {
		vi.mocked(projectsService.list)
			.mockRejectedValueOnce(new Error("caído"))
			.mockResolvedValue([fx.project]);
		const { user } = renderApp("/acme/projects");
		await user.click(await screen.findByRole("button", { name: "Try again" }));
		expect(await screen.findByText("Storefront")).toBeInTheDocument();
	});

	it("la barra lateral resalta solo la sección actual", async () => {
		renderApp("/acme/projects/storefront/issues");
		await screen.findByText(fx.issue().title);
		const nav = screen.getByRole("navigation", { name: "Main navigation" });
		const current = within(nav)
			.getAllByRole("link")
			.filter((a) => a.getAttribute("aria-current") === "page");
		expect(current.map((a) => a.textContent)).toEqual(["Issues"]);
	});

	it("cambiar de organización desde el selector navega a ella", async () => {
		vi.mocked(organizationsService.list).mockResolvedValue([
			fx.org,
			{ id: "org-2", name: "Beta Corp", slug: "beta", logo: null },
		]);
		const { user, router } = renderApp("/acme/projects");
		await user.click(
			await screen.findByRole("button", { name: "Switch organization" }),
		);
		await user.click(
			await screen.findByRole("menuitem", { name: /Beta Corp/ }),
		);
		await waitFor(() =>
			expect(router.state.location.pathname.startsWith("/beta")).toBe(true),
		);
		// La app carga los proyectos de la organización elegida.
		await waitFor(() =>
			expect(projectsService.list).toHaveBeenCalledWith("org-2"),
		);
	});
});
