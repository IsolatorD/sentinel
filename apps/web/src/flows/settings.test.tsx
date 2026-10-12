import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { projectsService } from "@/services/projectsService/projectsService";
import * as fx from "@/test/fixtures";
import {
	mockHappyPath,
	renderApp,
	SETTINGS_PATH,
	settingsSection,
} from "@/test/render-app";
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

const revokedKey = {
	...fx.key,
	id: "99999999-9999-4999-8999-999999999999",
	label: "Staging",
	isActive: false,
};

describe("configuración del proyecto", () => {
	it("muestra los datos generales, y las claves DSN y las instrucciones de instalación en su sección", async () => {
		const { user } = renderApp(SETTINGS_PATH);
		expect(await screen.findByLabelText("Project name")).toHaveValue(
			"Storefront",
		);
		expect(screen.getByLabelText("Platform")).toHaveValue("react");
		// Cada sección se muestra sola: las claves no aparecen en General.
		expect(screen.queryByTestId("key-row")).not.toBeInTheDocument();

		await user.click(
			within(screen.getByTestId("settings-nav")).getByRole("button", {
				name: "Keys and install",
			}),
		);
		const row = await screen.findByTestId("key-row");
		expect(within(row).getByText("Default")).toBeInTheDocument();
		expect(within(row).getByText("Active")).toBeInTheDocument();
		expect(within(row).getByText(fx.key.dsn)).toBeInTheDocument();

		const install = screen.getByTestId("install-instructions");
		expect(
			within(install).getByText(/npm install @sentinel\/react/),
		).toBeInTheDocument();
		expect(install).toHaveTextContent("Sentinel.ErrorBoundary");
		expect(install).toHaveTextContent(fx.key.dsn);
		expect(screen.queryByLabelText("Project name")).not.toBeInTheDocument();
	});

	it("el menú lateral recorre las secciones, marca la actual y se refleja en la URL", async () => {
		const { user, router } = renderApp(SETTINGS_PATH);
		const nav = await screen.findByTestId("settings-nav");
		expect(
			within(nav).getByRole("button", { name: "General" }),
		).toHaveAttribute("aria-current", "page");

		for (const [name, marker] of [
			["Data and limits", "usage-panel"],
			["Integrations", "jira-form"],
			["Danger zone", null],
		] as const) {
			await user.click(within(nav).getByRole("button", { name: name }));
			expect(within(nav).getByRole("button", { name })).toHaveAttribute(
				"aria-current",
				"page",
			);
			if (marker) expect(await screen.findByTestId(marker)).toBeInTheDocument();
		}
		expect(
			await screen.findByRole("button", { name: "Delete project" }),
		).toBeInTheDocument();
		expect(router.state.location.search).toMatchObject({ section: "danger" });

		await user.click(within(nav).getByRole("button", { name: "General" }));
		expect(await screen.findByLabelText("Project name")).toBeInTheDocument();
		// General es la sección por defecto: no hace falta en la URL.
		expect(router.state.location.search).not.toHaveProperty("section");
	});

	it("una sección desconocida en la URL cae en General", async () => {
		renderApp(`${SETTINGS_PATH}?section=inventada`);
		expect(await screen.findByLabelText("Project name")).toBeInTheDocument();
	});

	it("las instrucciones cambian con la plataforma del proyecto", async () => {
		vi.mocked(projectsService.get).mockResolvedValue({
			...fx.project,
			platform: "node",
		});
		renderApp(settingsSection("keys"));
		const install = await screen.findByTestId("install-instructions");
		await waitFor(() =>
			expect(install).toHaveAttribute("data-platform", "node"),
		);
		expect(
			within(install).getByText(/npm install @sentinel\/node/),
		).toBeInTheDocument();
		expect(install).toHaveTextContent("tracesSampleRate");
		expect(install).toHaveTextContent(fx.key.dsn);
		expect(within(install).queryByRole("tab")).not.toBeInTheDocument();
	});

	it("Python tiene su propio SDK; las plataformas sin SDK usan la API HTTP", async () => {
		vi.mocked(projectsService.get).mockResolvedValue({
			...fx.project,
			platform: "python",
		});
		const { unmount } = renderApp(settingsSection("keys"));
		const install = await screen.findByTestId("install-instructions");
		await waitFor(() =>
			expect(install).toHaveAttribute("data-platform", "python"),
		);
		expect(
			within(install).getByText(/pip install sentinel-sdk/),
		).toBeInTheDocument();
		expect(install).toHaveTextContent("SentinelAsgiMiddleware");
		unmount();

		vi.mocked(projectsService.get).mockResolvedValue({
			...fx.project,
			platform: "other",
		});
		renderApp(settingsSection("keys"));
		const other = await screen.findByTestId("install-instructions");
		await waitFor(() =>
			expect(other).toHaveAttribute("data-platform", "other"),
		);
		expect(other).toHaveTextContent("X-Sentinel-Key");
	});

	it("React Native tiene su propio SDK", async () => {
		vi.mocked(projectsService.get).mockResolvedValue({
			...fx.project,
			platform: "react-native",
		});
		renderApp(settingsSection("keys"));
		const install = await screen.findByTestId("install-instructions");
		await waitFor(() =>
			expect(install).toHaveAttribute("data-platform", "react-native"),
		);
		expect(
			within(install).getByText(/npm install @sentinel\/react-native/),
		).toBeInTheDocument();
		expect(install).toHaveTextContent("instrumentNavigation");
	});

	it("las instrucciones de JavaScript también se pueden ver como etiqueta <script>", async () => {
		vi.mocked(projectsService.get).mockResolvedValue({
			...fx.project,
			platform: "javascript",
		});
		const { user } = renderApp(settingsSection("keys"));
		await waitFor(() =>
			expect(screen.getByTestId("install-instructions")).toHaveAttribute(
				"data-platform",
				"javascript",
			),
		);
		const install = await screen.findByTestId("install-instructions");
		await user.click(within(install).getByRole("tab", { name: "Script tag" }));
		expect(install).toHaveTextContent(
			'<script src="https://your-cdn.example.com/sentinel.min.js"></script>',
		);
		expect(install).toHaveTextContent(fx.key.dsn);
	});

	it("guardar cambios envía el nombre y la plataforma, y confirma", async () => {
		vi.mocked(projectsService.update).mockResolvedValue({
			...fx.project,
			name: "Tienda",
		});
		const { user } = renderApp(SETTINGS_PATH);
		const name = await screen.findByLabelText("Project name");
		await user.clear(name);
		await user.type(name, "Tienda");
		await user.selectOptions(screen.getByLabelText("Platform"), "node");
		await user.click(
			screen.getAllByRole("button", { name: "Save changes" })[0],
		);

		expect(projectsService.update).toHaveBeenCalledWith(
			"org-1",
			fx.PROJECT_ID,
			{ name: "Tienda", platform: "node" },
		);
		expect(await screen.findByText("Changes saved.")).toBeInTheDocument();
	});

	it("no permite guardar un nombre vacío", async () => {
		const { user } = renderApp(SETTINGS_PATH);
		await user.clear(await screen.findByLabelText("Project name"));
		await user.click(
			screen.getAllByRole("button", { name: "Save changes" })[0],
		);
		expect(
			await screen.findByText("This field is required."),
		).toBeInTheDocument();
		expect(projectsService.update).not.toHaveBeenCalled();
	});

	it("un usuario sin permisos recibe un mensaje claro al intentar cambiar algo", async () => {
		vi.mocked(projectsService.update).mockRejectedValue(
			new ApiError(403, "Insufficient permissions"),
		);
		const { user } = renderApp(SETTINGS_PATH);
		await screen.findByLabelText("Project name");
		await user.click(
			screen.getAllByRole("button", { name: "Save changes" })[0],
		);
		expect(
			await screen.findByText(
				"Only owners and admins can change these settings.",
			),
		).toBeInTheDocument();
	});
});

describe("claves DSN", () => {
	it("revocar y volver a activar una clave", async () => {
		vi.mocked(projectsService.get).mockResolvedValue({
			...fx.project,
			keys: [fx.key, revokedKey],
		});
		vi.mocked(projectsService.updateKey).mockResolvedValue(fx.key);
		const { user } = renderApp(settingsSection("keys"));
		const rows = await screen.findAllByTestId("key-row");
		expect(within(rows[1]).getByText("Revoked")).toBeInTheDocument();

		await user.click(within(rows[0]).getByRole("button", { name: "Revoke" }));
		expect(projectsService.updateKey).toHaveBeenLastCalledWith(
			"org-1",
			fx.PROJECT_ID,
			fx.KEY_ID,
			{ isActive: false },
		);
		await user.click(within(rows[1]).getByRole("button", { name: "Enable" }));
		expect(projectsService.updateKey).toHaveBeenLastCalledWith(
			"org-1",
			fx.PROJECT_ID,
			revokedKey.id,
			{ isActive: true },
		);
	});

	it("crear una clave con etiqueta, o con la de por defecto", async () => {
		vi.mocked(projectsService.createKey).mockResolvedValue(fx.key);
		const { user } = renderApp(settingsSection("keys"));
		await user.type(await screen.findByLabelText("Label"), "Producción");
		await user.click(screen.getByRole("button", { name: "Create key" }));
		expect(projectsService.createKey).toHaveBeenLastCalledWith(
			"org-1",
			fx.PROJECT_ID,
			{ label: "Producción" },
		);

		await user.click(screen.getByRole("button", { name: "Create key" }));
		expect(projectsService.createKey).toHaveBeenLastCalledWith(
			"org-1",
			fx.PROJECT_ID,
			{ label: "New key" },
		);
	});

	it("eliminar una clave pide confirmación", async () => {
		const { user } = renderApp(settingsSection("keys"));
		await user.click(await screen.findByRole("button", { name: "Delete" }));
		const dialog = await screen.findByRole("dialog");
		expect(projectsService.removeKey).not.toHaveBeenCalled();
		await user.click(within(dialog).getByRole("button", { name: "Delete" }));
		expect(projectsService.removeKey).toHaveBeenCalledWith(
			"org-1",
			fx.PROJECT_ID,
			fx.KEY_ID,
		);
	});

	it("si falla una acción sobre las claves muestra el error", async () => {
		vi.mocked(projectsService.updateKey).mockRejectedValue(
			new ApiError(403, "Insufficient permissions"),
		);
		const { user } = renderApp(settingsSection("keys"));
		await user.click(await screen.findByRole("button", { name: "Revoke" }));
		expect(
			await screen.findByText(
				"Only owners and admins can change these settings.",
			),
		).toBeInTheDocument();
	});
});

describe("zona de peligro", () => {
	it("eliminar el proyecto exige escribir su nombre", async () => {
		const { user, router } = renderApp(settingsSection("danger"));
		await user.click(
			await screen.findByRole("button", { name: "Delete project" }),
		);
		const dialog = await screen.findByRole("dialog");
		const confirm = within(dialog).getByRole("button", {
			name: "Delete project",
		});
		expect(confirm).toBeDisabled();

		await user.type(
			within(dialog).getByLabelText("Project name"),
			"Otro nombre",
		);
		expect(confirm).toBeDisabled();
		await user.clear(within(dialog).getByLabelText("Project name"));
		await user.type(
			within(dialog).getByLabelText("Project name"),
			"Storefront",
		);
		expect(confirm).toBeEnabled();

		await user.click(confirm);
		expect(projectsService.remove).toHaveBeenCalledWith("org-1", fx.PROJECT_ID);
		await waitFor(() =>
			expect(router.state.location.pathname).toBe("/acme/projects"),
		);
	});
});
